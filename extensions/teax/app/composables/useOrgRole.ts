export function useOrgRole(orgId: string) {
  const { data } = useFetch<{ role: string }>(
    `/api/orgs/${orgId}/role`,
    { key: `org-role-${orgId}` },
  );

  const role = computed(() => data.value?.role ?? "member");
  const isOwnerOrAdmin = computed(() =>
    role.value === "admin" || role.value === "owner",
  );

  return { role, isOwnerOrAdmin };
}
