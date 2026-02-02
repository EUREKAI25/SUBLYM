-- AlterTable
ALTER TABLE "SmileReaction" ADD COLUMN     "comment" TEXT,
ADD COLUMN     "commentedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "filesize" INTEGER,
    "mimeType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "uploadedBy" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalDocument_type_idx" ON "LegalDocument"("type");

-- CreateIndex
CREATE INDEX "LegalDocument_type_isActive_idx" ON "LegalDocument"("type", "isActive");
