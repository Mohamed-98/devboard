import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async createLog(
    taskId: string,
    userId: string,
    action: string,
    details?: string,
  ) {
    return await this.prisma.activityLog.create({
      data: {
        taskId,
        userId,
        action,
        details,
      },
    });
  }

  async findByTaskId(taskId: string) {
    return await this.prisma.activityLog.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }
}
