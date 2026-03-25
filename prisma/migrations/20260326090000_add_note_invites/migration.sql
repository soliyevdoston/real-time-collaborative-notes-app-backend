-- CreateTable
CREATE TABLE "public"."NoteInvite" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "NoteInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoteInvite_noteId_invitedEmail_key" ON "public"."NoteInvite"("noteId", "invitedEmail");

-- CreateIndex
CREATE INDEX "NoteInvite_invitedEmail_idx" ON "public"."NoteInvite"("invitedEmail");

-- AddForeignKey
ALTER TABLE "public"."NoteInvite" ADD CONSTRAINT "NoteInvite_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "public"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NoteInvite" ADD CONSTRAINT "NoteInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
