/** Human-readable labels (Owner = company-level access, not “Director”). */
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Owner',
  ADMIN: 'Admin',
  SALES_HEAD: 'Sales Head',
  SUPPORT_HEAD: 'Support Head',
  TEAM_LEADER: 'Team Lead',
  AGENT: 'Agent',
};

export function formatRoleLabel(role: string, department?: string | null): string {
  const base = ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
  if (role === 'AGENT') {
    if (department === 'SALES') return 'Sales Agent';
    if (department === 'SUPPORT') return 'Support Agent';
  }
  if (role === 'TEAM_LEADER') {
    if (department === 'SALES') return 'Sales Team Lead';
    if (department === 'SUPPORT') return 'Support Team Lead';
  }
  return base;
}
