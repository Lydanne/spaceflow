import type { H3Event } from "h3";
import { useDB, schema } from "../db";

interface AuditLogParams {
  userId: string;
  organizationId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  detail?: Record<string, unknown>;
}

export async function writeAuditLog(event: H3Event, params: AuditLogParams) {
  try {
    const db = useDB();
    const ipAddress = getRequestHeader(event, "x-forwarded-for") ||
      getRequestHeader(event, "x-real-ip") ||
      "unknown";
    const userAgent = getRequestHeader(event, "user-agent") || "";

    await db.insert(schema.auditLogs).values({
      userId: params.userId,
      organizationId: params.organizationId || null,
      action: params.action,
      resourceType: params.resourceType || null,
      resourceId: params.resourceId || null,
      ipAddress,
      userAgent,
      detail: params.detail || {},
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
