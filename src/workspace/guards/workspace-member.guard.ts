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

    // If no workspaceId in params or body, but there's a projectId, look it up
    const projectId = request.params.id;
    if (!workspaceId && projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { workspaceId: true },
      });

      if (!project) {
        throw new NotFoundException(`Project with ID ${projectId} not found`);
      }
      workspaceId = project.workspaceId;
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
