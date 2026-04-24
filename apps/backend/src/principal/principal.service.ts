import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PrincipalService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Returns paginated audit log entries for the given school.
   */
  async getAuditLogs(schoolId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const sql = `
      SELECT al.*, u.email, u.firstName, u.lastName 
      FROM "AuditLog" al 
      JOIN "User" u ON al.actorId = u.id 
      JOIN "SchoolMembership" m ON u.id = m.userId 
      WHERE m.schoolId = ? 
      ORDER BY al.createdAt DESC LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) as count 
      FROM "AuditLog" al 
      JOIN "User" u ON al.actorId = u.id 
      JOIN "SchoolMembership" m ON u.id = m.userId 
      WHERE m.schoolId = ?
    `;

    const [logs, countResult] = await Promise.all([
      this.db.query(sql, [schoolId, limit, offset]),
      this.db.queryOne<{ count: number }>(countSql, [schoolId]),
    ]);

    const total = countResult?.count || 0;

    return {
      data: (logs as any[]).map((l) => ({
        ...l,
        actor: {
          id: l.actorId,
          email: l.email,
          firstName: l.firstName,
          lastName: l.lastName,
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
