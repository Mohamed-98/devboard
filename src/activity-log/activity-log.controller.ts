import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../workspace/guards/workspace-member.guard';

@Controller('activity-log')
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get('task/:taskId')
  findByTask(@Param('taskId') taskId: string) {
    return this.activityLogService.findByTaskId(taskId);
  }
}

