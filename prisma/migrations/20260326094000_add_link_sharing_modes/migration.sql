-- CreateEnum
CREATE TYPE "public"."LinkAccess" AS ENUM ('RESTRICTED', 'ANYONE_WITH_LINK');

-- CreateEnum
CREATE TYPE "public"."LinkPermission" AS ENUM ('VIEW', 'EDIT');

-- AlterTable
ALTER TABLE "public"."Note"
ADD COLUMN "linkAccess" "public"."LinkAccess" NOT NULL DEFAULT 'RESTRICTED',
ADD COLUMN "linkPermission" "public"."LinkPermission" NOT NULL DEFAULT 'VIEW';
