import { Injectable, NotFoundException, BadRequestException, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { PrismaService } from '../prisma/prisma.service';


import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createTaskDto: CreateTaskDto, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: createTaskDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${createTaskDto.projectId} not found`);
    }

    const task = await this.prisma.task.create({
      data: createTaskDto,
    });

    await this.activityLogService.createLog(task.id, userId, 'CREATE', `Task created: ${task.title}`);

    await this.invalidateCache(task.projectId);

    return task;
  }

  async findAll(filters: TaskFilterDto = {}) {
    const { status, priority, assigneeId, projectId, page = 1, limit = 10 } = filters;
    
    let cacheKey: string | null = null;
    if (projectId) {
      const version = (await this.cacheManager.get<number>(`tasks:project:${projectId}:version`)) || 0;
      cacheKey = `tasks:project:${projectId}:v${version}:${JSON.stringify(filters)}`;
    }
    
    if (cacheKey) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        this.logger.log(`Cache HIT for tasks:project:${projectId}`);
        return cached;
      }
      this.logger.log(`Cache MISS for tasks:project:${projectId}`);
    }

    const skip = (page - 1) * limit;

    const where = {
      status,
      priority,
      assigneeId,
      projectId,
    };

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        include: {
          assignee: {
            select: { id: true, email: true },
          },
          project: {
            select: { id: true, name: true, workspaceId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);

    const result = {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };

    if (cacheKey) {
      await this.cacheManager.set(cacheKey, result, 60000); // 1 minute cache
    }

    return result;
  }



  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignee: {
          select: { id: true, email: true },
        },
        project: {
          select: { id: true, name: true, workspaceId: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string) {
    const task = await this.findOne(id);
    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: updateTaskDto,
    });

    await this.activityLogService.createLog(id, userId, 'UPDATE', `Task updated: ${Object.keys(updateTaskDto).join(', ')}`);

    await this.invalidateCache(task.projectId);
    if (updatedTask.projectId !== task.projectId) {
      await this.invalidateCache(updatedTask.projectId);
    }

    return updatedTask;
  }

  async remove(id: string, userId: string) {
    const task = await this.findOne(id);
    
    // Log before deletion because of Cascade constraint
    await this.activityLogService.createLog(id, userId, 'DELETE', `Task deleted: ${task.title}`);

    await this.invalidateCache(task.projectId);

    return this.prisma.task.delete({
      where: { id },
    });
  }

  async assignTask(taskId: string, userId: string, actorId: string) {
    const task = await this.findOne(taskId);

    // Verify user exists and is a member of the workspace
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: task.project.workspaceId,
        members: {
          some: { id: userId },
        },
      },
    });

    if (!workspace) {
      throw new BadRequestException('User is not a member of the workspace or does not exist');
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: { assigneeId: userId },
      include: {
        assignee: {
          select: { id: true, email: true },
        },
      },
    });

    await this.activityLogService.createLog(taskId, actorId, 'ASSIGN', `Task assigned to user ${userId}`);

    await this.invalidateCache(updatedTask.projectId);

    return updatedTask;
  }

  private async invalidateCache(projectId: string) {
    if (projectId) {
      const version = (await this.cacheManager.get<number>(`tasks:project:${projectId}:version`)) || 0;
      await this.cacheManager.set(`tasks:project:${projectId}:version`, version + 1, 86400000); // 24 hours
    }
  }
}

