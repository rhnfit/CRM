-- Rename role labels for clearer governance (Owner vs department admin).
-- PostgreSQL: RENAME VALUE preserves existing rows.
ALTER TYPE "Role" RENAME VALUE 'DIRECTOR' TO 'SUPER_ADMIN';
ALTER TYPE "Role" RENAME VALUE 'MANAGER' TO 'ADMIN';
