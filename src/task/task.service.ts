import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { PrismaService } from '../prisma/prisma.service';


import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
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

    return task;
  }

  async findAll(filters: TaskFilterDto = {}) {
    const { status, priority, assigneeId, projectId, page = 1, limit = 10 } = filters;
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

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
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
    await this.findOne(id);
    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: updateTaskDto,
    });

    await this.activityLogService.createLog(id, userId, 'UPDATE', `Task updated: ${Object.keys(updateTaskDto).join(', ')}`);

    return updatedTask;
  }

  async remove(id: string, userId: string) {
    const task = await this.findOne(id);
    
    // Log before deletion because of Cascade constraint
    await this.activityLogService.createLog(id, userId, 'DELETE', `Task deleted: ${task.title}`);

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

    return updatedTask;
  }
}

