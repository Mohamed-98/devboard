import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from 'generated/prisma/client';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async create(createProjectDto: CreateProjectDto) {
    // Ensure workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: createProjectDto.workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${createProjectDto.workspaceId} not found`);
    }

    return this.prisma.project.create({
      data: createProjectDto,
    });
  }

  async findAll(user: any) {
    const where = user.role === Role.ADMIN
      ? {}
      : {
          workspace: {
            members: {
              some: { id: user.id },
            },
          },
        };

    return this.prisma.project.findMany({
      where,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }


  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    await this.findOne(id); // Ensure it exists

    return this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Ensure it exists

    return this.prisma.project.delete({
      where: { id },
    });
  }
}

