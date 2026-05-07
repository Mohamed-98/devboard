import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class TaskService {
  constructor(private prisma: PrismaService) {}

  async create(createTaskDto: CreateTaskDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: createTaskDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${createTaskDto.projectId} not found`);
    }

    return this.prisma.task.create({
      data: createTaskDto,
    });
  }

  async findAll(filters: TaskFilterDto = {}) {
    const { status, priority, assigneeId, projectId } = filters;

    return this.prisma.task.findMany({
      where: {
        status,
        priority,
        assigneeId,
        projectId,
      },
      include: {
        assignee: {
          select: { id: true, email: true },
        },
        project: {
          select: { id: true, name: true, workspaceId: true },
        },
      },
    });
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

  async update(id: string, updateTaskDto: UpdateTaskDto) {
    await this.findOne(id);
    return this.prisma.task.update({
      where: { id },
      data: updateTaskDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.task.delete({
      where: { id },
    });
  }

  async assignTask(taskId: string, userId: string) {
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

    return this.prisma.task.update({
      where: { id: taskId },
      data: { assigneeId: userId },
      include: {
        assignee: {
          select: { id: true, email: true },
        },
      },
    });
  }
}

