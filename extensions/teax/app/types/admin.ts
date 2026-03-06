export interface TeamItem {
  id: string;
  organizationId: string;
  giteaTeamId: number;
  name: string;
  description: string | null;
  syncedAt: string | null;
  createdAt: string;
  memberCount: number;
}

export interface MemberItem {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  giteaId: number;
}

export interface PermissionGroup {
  id: string;
  type: "default" | "custom";
  name: string;
  description: string | null;
  permissions: string[];
  repositoryIds: string[] | null;
}

export interface TeamPermissionAssignment {
  id: string;
  teamId: string;
  permissionGroupId: string;
  groupName: string;
  groupDescription: string | null;
  permissions: string[];
}

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}
