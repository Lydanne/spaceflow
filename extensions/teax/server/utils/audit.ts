import type { H3Event } from "h3";
import { useDB, schema } from "~~/server/db";

interface AuditLogParams {
  user_id: string;
  organization_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
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
      user_id: params.user_id,
      organization_id: params.organization_id || null,
      action: params.action,
      resource_type: params.resource_type || null,
      resource_id: params.resource_id || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      detail: params.detail || {},
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
