-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teamId" TEXT,
    "department" "Department",
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "mapsToStatus" "LeadStatus",
    "color" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "stageId" TEXT,
ADD COLUMN "kanbanOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pipelineId" TEXT;

-- CreateIndex
CREATE INDEX "PipelineStage_pipelineId_sortOrder_idx" ON "PipelineStage"("pipelineId", "sortOrder");

CREATE INDEX "Lead_stageId_idx" ON "Lead"("stageId");
CREATE INDEX "Lead_pipelineId_idx" ON "Lead"("pipelineId");
CREATE INDEX "Lead_pipelineId_stageId_assignedTo_idx" ON "Lead"("pipelineId", "stageId", "assignedTo");
CREATE INDEX "Lead_stageId_kanbanOrder_idx" ON "Lead"("stageId", "kanbanOrder");

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
