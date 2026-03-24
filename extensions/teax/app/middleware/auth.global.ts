export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();

  const publicPaths = ["/auth/login", "/auth/callback/gitea", "/auth/callback/feishu", "/auth/select-account"];

  if (publicPaths.some((p) => to.path.startsWith(p))) {
    return;
  }

  if (!loggedIn.value) {
    return navigateTo("/auth/login");
  }
});
