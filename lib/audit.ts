// ============================================
// FILE: lib/audit.ts
// ============================================
import prisma from './db';

export async function createAuditLog(
  action: string,
  entityType: string,
  entityId?: number,
  data?: any,
  request?: Request
) {
  try {
    const ipAddress = request?.headers.get('x-forwarded-for') || 
                      request?.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request?.headers.get('user-agent') || 'unknown';

    await prisma.auditLog.create({
      data: {
        action,
        entity_type: entityType,
        entity_id: entityId,
        data: data ? JSON.parse(JSON.stringify(data)) : null,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}