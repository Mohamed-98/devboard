import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class CommentService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  async create(createCommentDto: CreateCommentDto, authorId: string) {
    const { taskId, content } = createCommentDto;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    const comment = await this.prisma.comment.create({
      data: {
        content,
        taskId,
        authorId,
      },
    });

    await this.activityLogService.createLog(
      taskId,
      authorId,
      'COMMENT_CREATE',
      `User commented on task: ${content.substring(0, 50)}`,
    );

    return comment;
  }

  async remove(id: string, userId: string) {
    const comment = await this.findOne(id);

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    const deletedComment = await this.prisma.comment.delete({
      where: { id },
    });

    await this.activityLogService.createLog(
      comment.taskId,
      userId,
      'COMMENT_DELETE',
      `User deleted their comment`,
    );

    return deletedComment;
  }

  async findAll(taskId?: string) {
    return this.prisma.comment.findMany({
      where: taskId ? { taskId } : {},
      include: {
        author: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, email: true },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    return comment;
  }
}

