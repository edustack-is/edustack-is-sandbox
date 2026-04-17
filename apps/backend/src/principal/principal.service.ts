import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrincipalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns paginated audit log entries for the given school.
   * Accessible only by Principal and System Admin.
   */
  async getAuditLogs(schoolId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    // Get audit logs for entities within this school or global actions
    // We filter by actorId being a member of this school
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          actor: {
            schoolMemberships: {
              some: { schoolId },
            },
          },
        },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({
        where: {
          actor: {
            schoolMemberships: {
              some: { schoolId },
            },
          },
        },
      }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
