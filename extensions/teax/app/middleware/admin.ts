export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith("/-/admin")) {
    return;
  }

  const { user } = useUserSession();
  if (!user.value?.isAdmin) {
    return navigateTo("/");
  }
});
