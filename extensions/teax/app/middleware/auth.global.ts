export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();

  const publicPaths = ["/auth/login", "/auth/callback/gitea", "/auth/callback/feishu", "/auth/select-account"];

  if (publicPaths.some((p) => to.path.startsWith(p))) {
    return;
  }

  if (!loggedIn.value) {
    // 保存原始路径，登录后跳回
    const redirect = to.fullPath;
    return navigateTo(`/auth/login?redirect=${encodeURIComponent(redirect)}`);
  }
});
