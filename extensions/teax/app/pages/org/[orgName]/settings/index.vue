<script setup lang="ts">
definePageMeta({
  middleware: [
    (to) => {
      const orgName = to.params.orgName as string;
      return navigateTo(`/org/${orgName}/settings/teams`, { replace: true });
    },
  ],
});
</script>
