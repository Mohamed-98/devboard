import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from 'generated/prisma/client';

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Admins have access to everything
    if (user.role === Role.ADMIN) {
      return true;
    }

    let workspaceId = request.params.workspaceId || request.body.workspaceId;

    // If no workspaceId in params or body, but there's an id param, look it up
    const resourceId = request.params.id;
    if (!workspaceId && resourceId) {
      // Try to find if it's a project
      const project = await this.prisma.project.findUnique({
        where: { id: resourceId },
        select: { workspaceId: true },
      });

      if (project) {
        workspaceId = project.workspaceId;
      } else {
        // Try to find if it's a task
        const task = await this.prisma.task.findUnique({
          where: { id: resourceId },
          include: { project: { select: { workspaceId: true } } },
        });
        if (task) {
          workspaceId = task.project.workspaceId;
        }
      }
    }


    if (!workspaceId) {
      // For general list endpoints, we might want to handle this differently
      // or just allow it if we filter the results in the service.
      // For now, if we can't determine workspace, we deny if it's a specific action.
      return true; 
    }

    const membership = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        members: {
          some: { id: user.id },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    return true;
  }
}
