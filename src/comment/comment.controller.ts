import { Controller, Get, Post, Body, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { WorkspaceMemberGuard } from '../workspace/guards/workspace-member.guard';

@Controller('comment')
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  create(@Body() createCommentDto: CreateCommentDto, @GetUser('id') userId: string) {
    return this.commentService.create(createCommentDto, userId);
  }

  @Get()
  findAll(@Query('taskId') taskId: string) {
    return this.commentService.findAll(taskId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.commentService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.commentService.remove(id, userId);
  }
}

