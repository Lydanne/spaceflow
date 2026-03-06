export interface TeamItem {
  id: string;
  organization_id: string;
  gitea_team_id: number;
  name: string;
  description: string | null;
  synced_at: string | null;
  created_at: string;
  member_count: number;
}

export interface MemberItem {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  username: string;
  email: string;
  avatar_url: string | null;
  gitea_id: number;
}

export interface PermissionGroup {
  id: string;
  type: "default" | "custom";
  name: string;
  description: string | null;
  permissions: string[];
  repository_ids: string[] | null;
}

export interface TeamPermissionAssignment {
  id: string;
  team_id: string;
  permission_group_id: string;
  group_name: string;
  group_description: string | null;
  permissions: string[];
}

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}
