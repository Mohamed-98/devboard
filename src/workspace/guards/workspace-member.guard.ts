import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from 'generated/prisma/client';

import { Reflector } from '@nestjs/core';
import { SKIP_WORKSPACE_CHECK_KEY } from '../decorators/skip-workspace-check.decorator';

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_WORKSPACE_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Admins have access to everything
    if (user.role === Role.ADMIN) {
      return true;
    }

    // 1. Primary resolution: direct workspaceId
    let workspaceId =
      request.params.workspaceId ||
      request.body?.workspaceId ||
      request.query?.workspaceId;

    // UUID validation regex
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // 2. Secondary resolution: via projectId or resourceId (params.id)
    if (!workspaceId) {
      const projectId = request.body?.projectId || request.query?.projectId;
      const resourceId = request.params.id;

      // Try projectId first
      if (projectId && uuidRegex.test(projectId)) {
        const project = await this.prisma.project.findUnique({
          where: { id: projectId },
          select: { workspaceId: true },
        });
        workspaceId = project?.workspaceId;
      }

      // Try resourceId if still not found
      if (!workspaceId && resourceId && uuidRegex.test(resourceId)) {
        // Try project lookup
        const project = await this.prisma.project.findUnique({
          where: { id: resourceId },
          select: { workspaceId: true },
        });

        if (project) {
          workspaceId = project.workspaceId;
        } else {
          // Try task lookup
          const task = await this.prisma.task.findUnique({
            where: { id: resourceId },
            include: { project: { select: { workspaceId: true } } },
          });
          if (task) {
            workspaceId = task.project.workspaceId;
          } else {
            // Try workspace lookup (id itself might be workspaceId)
            const workspace = await this.prisma.workspace.findUnique({
              where: { id: resourceId },
              select: { id: true },
            });
            workspaceId = workspace?.id;
          }
        }
      }
    }

    // 3. Final check: can we determine membership?
    if (!workspaceId) {
      // If we've reached here, it means we couldn't resolve a workspaceId
      // and the endpoint didn't have @SkipWorkspaceCheck().
      // To be safe and prevent data leaks (Bug #2), we deny access.
      throw new ForbiddenException(
        'Workspace context is required for this request',
      );
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
