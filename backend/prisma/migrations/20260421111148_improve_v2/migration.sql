-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "leadId" TEXT,
DROP COLUMN "priority",
ADD COLUMN "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "WhatsappMessage" ALTER COLUMN "body" SET DATA TYPE VARCHAR(2000);

-- CreateIndex
CREATE INDEX "Lead_isDeleted_idx" ON "Lead"("isDeleted");

-- CreateIndex
CREATE INDEX "Ticket_leadId_idx" ON "Ticket"("leadId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
