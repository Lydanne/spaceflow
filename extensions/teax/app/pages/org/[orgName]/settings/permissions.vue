<script setup lang="ts">
import type { ComputedRef } from "vue";
import type { PermissionGroup, PermissionDef } from "~/types/admin";

const orgName = inject<string>("orgName")!;
const allGroups = inject<ComputedRef<PermissionGroup[]>>("allGroups")!;
const availablePermissions = inject<ComputedRef<PermissionDef[]>>("availablePermissions")!;
const refreshGroups = inject<() => Promise<void>>("refreshGroups")!;
</script>

<template>
  <AdminOrgPermissionPanel
    :org-name="orgName"
    :all-groups="allGroups"
    :available-permissions="availablePermissions"
    :show-repo-scope="false"
    @refresh-groups="refreshGroups"
  />
</template>
