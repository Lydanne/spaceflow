<script setup lang="ts">
import type { ComputedRef } from "vue";
import type { TeamItem, PermissionGroup } from "~/types/admin";

const orgName = inject<string>("orgName")!;
const teams = inject<ComputedRef<TeamItem[]>>("teams")!;
const allGroups = inject<ComputedRef<PermissionGroup[]>>("allGroups")!;
const refreshTeams = inject<() => Promise<void>>("refreshTeams")!;
</script>

<template>
  <AdminOrgTeamPanel
    :org-name="orgName"
    :teams="teams"
    :all-groups="allGroups"
    api-prefix="/api/orgs"
    :show-member-actions="false"
    @refresh-teams="refreshTeams"
  />
</template>
