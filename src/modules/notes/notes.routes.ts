import { Router } from "express";
import { requireAuth } from "../../shared/middleware/auth";
import { validateBody, validateParams, validateQuery } from "../../shared/middleware/validate";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  addCollaboratorSchema,
  collaboratorParamSchema,
  collaboratorSuggestionQuerySchema,
  createNoteSchema,
  inviteParamSchema,
  noteIdParamSchema,
  updateShareSchema,
  updateNoteSchema,
} from "./notes.schema";
import { notesController } from "./notes.controller";

export const notesRouter = Router();

notesRouter.use(requireAuth);

notesRouter.get("/", asyncHandler(notesController.list));
notesRouter.post("/", validateBody(createNoteSchema), asyncHandler(notesController.create));
notesRouter.get("/:noteId", validateParams(noteIdParamSchema), asyncHandler(notesController.getById));
notesRouter.patch(
  "/:noteId",
  validateParams(noteIdParamSchema),
  validateBody(updateNoteSchema),
  asyncHandler(notesController.update),
);
notesRouter.patch(
  "/:noteId/share",
  validateParams(noteIdParamSchema),
  validateBody(updateShareSchema),
  asyncHandler(notesController.updateShare),
);
notesRouter.delete(
  "/:noteId",
  validateParams(noteIdParamSchema),
  asyncHandler(notesController.remove),
);
notesRouter.post(
  "/:noteId/collaborators",
  validateParams(noteIdParamSchema),
  validateBody(addCollaboratorSchema),
  asyncHandler(notesController.addCollaborator),
);
notesRouter.get(
  "/:noteId/collaborators/suggestions",
  validateParams(noteIdParamSchema),
  validateQuery(collaboratorSuggestionQuerySchema),
  asyncHandler(notesController.suggestCollaborators),
);
notesRouter.get(
  "/:noteId/invites",
  validateParams(noteIdParamSchema),
  asyncHandler(notesController.listInvites),
);
notesRouter.delete(
  "/:noteId/collaborators/:userId",
  validateParams(collaboratorParamSchema),
  asyncHandler(notesController.removeCollaborator),
);
notesRouter.delete(
  "/:noteId/invites/:inviteId",
  validateParams(inviteParamSchema),
  asyncHandler(notesController.removeInvite),
);
