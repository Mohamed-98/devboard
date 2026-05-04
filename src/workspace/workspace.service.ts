import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async create(createWorkspaceDto: CreateWorkspaceDto) {
    return this.prisma.workspace.create({
      data: createWorkspaceDto,
    });
  }

  async findAll() {
    return this.prisma.workspace.findMany({
      include: {
        _count: {
          select: { members: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${id} not found`);
    }

    return workspace;
  }

  async update(id: string, updateWorkspaceDto: UpdateWorkspaceDto) {
    await this.findOne(id); // Ensure it exists

    return this.prisma.workspace.update({
      where: { id },
      data: updateWorkspaceDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Ensure it exists

    return this.prisma.workspace.delete({
      where: { id },
    });
  }
}

