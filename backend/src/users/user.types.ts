import { Department, Role } from '@prisma/client';

export type AuthUser = {
  id: string;
  role: Role;
  department: Department;
  teamId: string | null;
  managerId: string | null;
};
