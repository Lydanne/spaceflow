/**
 * 场景权限 Composable
 * 提供前端场景权限检查和申请跳转功能
 */

import {
  getSceneDefinition,
  getSceneName,
  buildPermissionRequestUrl,
  type SceneDefinition,
} from "~~/shared/scene-permissions";

export interface PermissionError {
  statusCode: number;
  data?: {
    code?: string;
    scene_key?: string;
    scene_name?: string;
    permissions?: string;
    permission?: string;
    organization_id?: string;
    team_id?: string;
  };
}

export interface UseScenePermissionReturn {
  /** 获取场景定义 */
  getScene: (sceneKey: string) => SceneDefinition | undefined;
  /** 获取场景显示名称 */
  getSceneName: (sceneKey: string) => string;
  /** 跳转到权限申请页面 */
  redirectToRequest: (params: {
    sceneKey: string;
    orgId: string;
    teamId?: string;
    redirect?: string;
  }) => void;
  /** 处理 API 错误，如果是权限错误则自动跳转 */
  handlePermissionError: (error: unknown) => boolean;
  /** 检查错误是否为权限不足错误 */
  isPermissionError: (error: unknown) => boolean;
}

/**
 * 场景权限 Composable
 *
 * 使用示例：
 * ```ts
 * const { handlePermissionError } = useScenePermission();
 *
 * const { data, error } = await useFetch('/api/xxx');
 *
 * watch(error, (err) => {
 *   handlePermissionError(err);
 * });
 * ```
 */
export function useScenePermission(): UseScenePermissionReturn {
  const router = useRouter();
  const route = useRoute();

  /**
   * 获取场景定义
   */
  function getScene(sceneKey: string): SceneDefinition | undefined {
    return getSceneDefinition(sceneKey);
  }

  /**
   * 跳转到权限申请页面
   */
  function redirectToRequest(params: {
    sceneKey: string;
    orgId: string;
    teamId?: string;
    redirect?: string;
  }) {
    const scene = getSceneDefinition(params.sceneKey);
    if (!scene) {
      console.warn(`[useScenePermission] Unknown scene: ${params.sceneKey}`);
      return;
    }

    const url = buildPermissionRequestUrl({
      scene: scene.name,
      permissions: scene.permissions.join(","),
      org_id: params.orgId,
      team_id: params.teamId,
      redirect: params.redirect ?? route.fullPath,
    });

    router.replace(url);
  }

  /**
   * 检查错误是否为权限不足错误
   */
  function isPermissionError(error: unknown): boolean {
    const err = error as PermissionError;
    if (err?.statusCode !== 403) return false;
    const code = err.data?.code;
    return code === "PERMISSION_DENIED" || code === "SCENE_PERMISSION_DENIED";
  }

  /**
   * 处理 API 错误
   * 如果是权限不足错误，自动跳转到申请页面
   * 返回 true 表示已处理（是权限错误），false 表示未处理
   */
  function handlePermissionError(error: unknown): boolean {
    if (!error) return false;

    const err = error as PermissionError;
    if (!isPermissionError(err)) return false;

    const { scene_name, permissions, permission, organization_id, team_id } = err.data ?? {};

    // 优先使用 scene_key（新格式），否则使用 permission（旧格式）
    const sceneName = scene_name ?? "权限申请";
    const permissionList = permissions ?? permission ?? "";

    if (!organization_id) {
      console.warn("[useScenePermission] Missing organization_id in permission error");
      return true;
    }

    const url = buildPermissionRequestUrl({
      scene: sceneName,
      permissions: permissionList,
      org_id: organization_id,
      team_id: team_id,
      redirect: route.fullPath,
    });

    router.replace(url);
    return true;
  }

  return {
    getScene,
    getSceneName,
    redirectToRequest,
    handlePermissionError,
    isPermissionError,
  };
}
