/**
 * 飞书 SDK 用户相关类型
 */

/** 用户 ID 类型 */
export type UserIdType = "open_id" | "union_id" | "user_id";

/** 用户信息 */
export interface FeishuUser {
  /** 用户的 union_id */
  union_id?: string;
  /** 用户的 user_id */
  user_id?: string;
  /** 用户的 open_id */
  open_id?: string;
  /** 用户名 */
  name?: string;
  /** 英文名 */
  en_name?: string;
  /** 昵称 */
  nickname?: string;
  /** 邮箱 */
  email?: string;
  /** 手机号 */
  mobile?: string;
  /** 手机号码可见性 */
  mobile_visible?: boolean;
  /** 性别 */
  gender?: number;
  /** 头像 */
  avatar?: {
    avatar_72?: string;
    avatar_240?: string;
    avatar_640?: string;
    avatar_origin?: string;
  };
  /** 用户状态 */
  status?: {
    is_frozen?: boolean;
    is_resigned?: boolean;
    is_activated?: boolean;
    is_exited?: boolean;
    is_unjoin?: boolean;
  };
  /** 所属部门 ID 列表 */
  department_ids?: string[];
  /** 直属主管的用户 ID */
  leader_user_id?: string;
  /** 城市 */
  city?: string;
  /** 国家或地区 */
  country?: string;
  /** 工位 */
  work_station?: string;
  /** 入职时间 */
  join_time?: number;
  /** 是否是租户管理员 */
  is_tenant_manager?: boolean;
  /** 工号 */
  employee_no?: string;
  /** 员工类型 */
  employee_type?: number;
  /** 企业邮箱 */
  enterprise_email?: string;
  /** 职务 */
  job_title?: string;
}

/** 获取用户信息的参数 */
export interface GetUserParams {
  /** 用户 ID */
  userId: string;
  /** 用户 ID 类型 */
  userIdType?: UserIdType;
  /** 部门 ID 类型 */
  departmentIdType?: "department_id" | "open_department_id";
}
