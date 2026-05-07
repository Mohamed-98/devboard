import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TaskStatus, TaskPriority } from 'generated/prisma/client';

export class TaskFilterDto {
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsUUID()
  @IsOptional()
  assigneeId?: string;

  @IsUUID()
  @IsOptional()
  projectId?: string;
}
