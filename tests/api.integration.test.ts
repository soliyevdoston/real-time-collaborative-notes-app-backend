import request, { SuperAgentTest } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/shared/db/prisma";

type Session = {
  agent: SuperAgentTest;
  accessToken: string;
  userId: string;
  email: string;
};

const runId = `it_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
const createdEmails: string[] = [];
const app = createApp();

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const register = async (name: string, email: string): Promise<Session> => {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/register").send({
    name,
    email,
    password: "Password123!",
  });

  expect(response.status).toBe(201);
  expect(response.body?.accessToken).toBeTypeOf("string");
  expect(response.body?.user?.id).toBeTypeOf("string");

  createdEmails.push(email);

  return {
    agent,
    accessToken: String(response.body.accessToken),
    userId: String(response.body.user.id),
    email,
  };
};

describe("REST integration smoke", () => {
  beforeAll(async () => {
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: createdEmails,
          },
        },
      });
    }

    await prisma.$disconnect();
  });

  it("auth register -> me -> refresh -> logout flow works", async () => {
    const email = `${runId}_auth@example.com`;
    const session = await register("Auth Test", email);

    const me = await session.agent
      .get("/api/auth/me")
      .set(authHeader(session.accessToken));
    expect(me.status).toBe(200);
    expect(me.body?.user?.email).toBe(email);

    const refreshed = await session.agent.post("/api/auth/refresh");
    expect(refreshed.status).toBe(200);
    expect(refreshed.body?.accessToken).toBeTypeOf("string");

    const logout = await session.agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);

    const refreshAfterLogout = await session.agent.post("/api/auth/refresh");
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("notes, collaboration, link permissions, comments, pending invites work", async () => {
    const owner = await register("Owner", `${runId}_owner@example.com`);
    const collaborator = await register("Collaborator", `${runId}_collab@example.com`);

    const createNote = await owner.agent
      .post("/api/notes")
      .set(authHeader(owner.accessToken))
      .send({ title: "Integration Note" });

    expect(createNote.status).toBe(201);
    const noteId = String(createNote.body?.note?.id);

    const addCollaborator = await owner.agent
      .post(`/api/notes/${noteId}/collaborators`)
      .set(authHeader(owner.accessToken))
      .send({ email: collaborator.email });
    expect(addCollaborator.status).toBe(200);
    expect(addCollaborator.body?.delivery).toBe("added");

    const collaboratorCanGet = await collaborator.agent
      .get(`/api/notes/${noteId}`)
      .set(authHeader(collaborator.accessToken));
    expect(collaboratorCanGet.status).toBe(200);

    const collaboratorCanEdit = await collaborator.agent
      .patch(`/api/notes/${noteId}`)
      .set(authHeader(collaborator.accessToken))
      .send({ title: "Collaborator Edited" });
    expect(collaboratorCanEdit.status).toBe(200);

    const setViewShare = await owner.agent
      .patch(`/api/notes/${noteId}/share`)
      .set(authHeader(owner.accessToken))
      .send({ linkAccess: "ANYONE_WITH_LINK", linkPermission: "VIEW" });
    expect(setViewShare.status).toBe(200);

    const viewer = await register("Viewer", `${runId}_viewer@example.com`);

    const viewerCanView = await viewer.agent
      .get(`/api/notes/${noteId}`)
      .set(authHeader(viewer.accessToken));
    expect(viewerCanView.status).toBe(200);
    expect(viewerCanView.body?.note?.currentAccessRole).toBe("VIEWER");

    const viewerCannotEditInViewMode = await viewer.agent
      .patch(`/api/notes/${noteId}`)
      .set(authHeader(viewer.accessToken))
      .send({ title: "Should fail" });
    expect(viewerCannotEditInViewMode.status).toBe(403);

    const setEditShare = await owner.agent
      .patch(`/api/notes/${noteId}/share`)
      .set(authHeader(owner.accessToken))
      .send({ linkAccess: "ANYONE_WITH_LINK", linkPermission: "EDIT" });
    expect(setEditShare.status).toBe(200);

    const viewerCanEditInEditMode = await viewer.agent
      .patch(`/api/notes/${noteId}`)
      .set(authHeader(viewer.accessToken))
      .send({ title: "Viewer edited in link mode" });
    expect(viewerCanEditInEditMode.status).toBe(200);

    const viewerCanComment = await viewer.agent
      .post(`/api/notes/${noteId}/comments`)
      .set(authHeader(viewer.accessToken))
      .send({ body: "Comment from viewer" });
    expect(viewerCanComment.status).toBe(201);
    const commentId = String(viewerCanComment.body?.comment?.id);

    const ownerResolvesComment = await owner.agent
      .patch(`/api/comments/${commentId}/resolve`)
      .set(authHeader(owner.accessToken));
    expect(ownerResolvesComment.status).toBe(200);

    const backToView = await owner.agent
      .patch(`/api/notes/${noteId}/share`)
      .set(authHeader(owner.accessToken))
      .send({ linkAccess: "ANYONE_WITH_LINK", linkPermission: "VIEW" });
    expect(backToView.status).toBe(200);

    const viewerCannotCommentInViewMode = await viewer.agent
      .post(`/api/notes/${noteId}/comments`)
      .set(authHeader(viewer.accessToken))
      .send({ body: "Should fail" });
    expect(viewerCannotCommentInViewMode.status).toBe(403);

    const viewerCanListVersions = await viewer.agent
      .get(`/api/notes/${noteId}/versions`)
      .set(authHeader(viewer.accessToken));
    expect(viewerCanListVersions.status).toBe(200);

    const removeCollaborator = await owner.agent
      .delete(`/api/notes/${noteId}/collaborators/${collaborator.userId}`)
      .set(authHeader(owner.accessToken));
    expect(removeCollaborator.status).toBe(200);

    const collaboratorAfterRemove = await collaborator.agent
      .get(`/api/notes/${noteId}`)
      .set(authHeader(collaborator.accessToken));
    expect(collaboratorAfterRemove.status).toBe(200);

    const lockRestricted = await owner.agent
      .patch(`/api/notes/${noteId}/share`)
      .set(authHeader(owner.accessToken))
      .send({ linkAccess: "RESTRICTED", linkPermission: "VIEW" });
    expect(lockRestricted.status).toBe(200);

    const collaboratorDeniedWhenRestricted = await collaborator.agent
      .get(`/api/notes/${noteId}`)
      .set(authHeader(collaborator.accessToken));
    expect(collaboratorDeniedWhenRestricted.status).toBe(403);

    const pendingEmail = `${runId}_pending@example.com`;
    const invitePending = await owner.agent
      .post(`/api/notes/${noteId}/collaborators`)
      .set(authHeader(owner.accessToken))
      .send({ email: pendingEmail });
    expect(invitePending.status).toBe(200);
    expect(invitePending.body?.delivery).toBe("invited");

    const pendingUser = await register("Pending User", pendingEmail);
    const pendingNotes = await pendingUser.agent
      .get("/api/notes")
      .set(authHeader(pendingUser.accessToken));
    expect(pendingNotes.status).toBe(200);
    const hasInvitedNote = (pendingNotes.body?.notes ?? []).some(
      (note: { id: string }) => note.id === noteId,
    );
    expect(hasInvitedNote).toBe(true);

    const deleteNote = await owner.agent
      .delete(`/api/notes/${noteId}`)
      .set(authHeader(owner.accessToken));
    expect(deleteNote.status).toBe(204);
  }, 25000);
});
