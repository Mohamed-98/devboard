import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommentService {
  constructor(private prisma: PrismaService) {}

  async create(createCommentDto: CreateCommentDto, authorId: string) {
    const { taskId, content } = createCommentDto;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    return this.prisma.comment.create({
      data: {
        content,
        taskId,
        authorId,
      },
    });
  }

  async remove(id: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    return this.prisma.comment.delete({
      where: { id },
    });
  }

  findAll() {
    return this.prisma.comment.findMany();
  }

  findOne(id: string) {
    return this.prisma.comment.findUnique({
      where: { id },
    });
  }
}

