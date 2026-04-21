-- Fast list queries: composite btree indexes matching CRM filters + ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "User_department_isActive_idx" ON "User"("department", "isActive");
CREATE INDEX IF NOT EXISTS "User_teamId_isActive_idx" ON "User"("teamId", "isActive");

CREATE INDEX IF NOT EXISTS "Lead_assignedTo_isDeleted_createdAt_idx" ON "Lead"("assignedTo", "isDeleted", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Lead_assignedTo_isDeleted_status_createdAt_idx" ON "Lead"("assignedTo", "isDeleted", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Lead_assignedTo_isDeleted_source_createdAt_idx" ON "Lead"("assignedTo", "isDeleted", "source", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Ticket_assignedTo_createdAt_idx" ON "Ticket"("assignedTo", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Ticket_assignedTo_status_createdAt_idx" ON "Ticket"("assignedTo", "status", "createdAt" DESC);

-- Fuzzy search (ILIKE %term%): requires pg_trgm — dramatically faster than sequential scan on large tables
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Lead_name_trgm_idx" ON "Lead" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_phone_trgm_idx" ON "Lead" USING gin ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_productInterest_trgm_idx" ON "Lead" USING gin ("productInterest" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Ticket_customerName_trgm_idx" ON "Ticket" USING gin ("customerName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Ticket_phone_trgm_idx" ON "Ticket" USING gin ("phone" gin_trgm_ops);
