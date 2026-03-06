export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith("/-/admin")) {
    return;
  }

  const { user } = useUserSession();
  if (!user.value?.is_admin) {
    return navigateTo("/");
  }
});
