/* eslint-disable @typescript-eslint/no-unused-vars */
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

    let workspaceId =
      request.params.workspaceId ||
      request.body?.workspaceId ||
      request.query?.workspaceId;
    const projectId = request.body?.projectId || request.query?.projectId;

    // If no workspaceId in params or body, but there's an id param, look it up
    const resourceId = request.params.id;

    // UUID validation regex
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Resolve workspaceId from projectId if available
    if (!workspaceId && projectId && uuidRegex.test(projectId)) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { workspaceId: true },
      });
      if (project) {
        workspaceId = project.workspaceId;
      }
    }

    if (!workspaceId && resourceId && uuidRegex.test(resourceId)) {
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
      // For non-admins, if we can't resolve a workspace:
      // 1. Allow GET requests to list endpoints (no ID in params/body/query)
      //    We assume the service will filter results (e.g., ProjectService.findAll).
      // 2. Deny specific resource access or mutations if we should have resolved it.
      const isResourceAccess = !!(resourceId || projectId);
      const isMutation = request.method !== 'GET';

      if (isMutation || isResourceAccess) {
        // If it's a mutation or specific resource access and we can't find a workspace,
        // we deny access to be safe. If the ID is invalid or missing, 
        // the ValidationPipe or Service would have handled it, but a 403 is safer than a leak.
        throw new ForbiddenException('Could not determine workspace context for this request');
      }

      return true;
    }

    // Ensure workspaceId is a valid UUID before querying Prisma
    if (!uuidRegex.test(workspaceId)) {
      // If invalid UUID, let the service/controller handle it (will likely be 404 or 400)
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
