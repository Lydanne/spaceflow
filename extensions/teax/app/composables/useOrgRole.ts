export function useOrgRole(orgName: string) {
  const { data } = useFetch<{ role: string }>(
    `/api/orgs/${orgName}/role`,
    { key: `org-role-${orgName}` },
  );

  const role = computed(() => data.value?.role ?? "member");
  const isOwnerOrAdmin = computed(() =>
    role.value === "admin" || role.value === "owner",
  );

  return { role, isOwnerOrAdmin };
}
