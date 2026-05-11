import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TaskPriority } from 'generated/prisma/client';

describe('TaskService', () => {
  let service: TaskService;
  let prisma: any;
  let activityLogService: any;
  let cacheManager: any;

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn(),
      },
      task: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workspace: {
        findFirst: jest.fn(),
      },
    };
    activityLogService = {
      createLog: jest.fn(),
    };
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: activityLogService },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  describe('create', () => {
    it('should create a task', async () => {
      const createTaskDto = {
        title: 'Test Task',
        projectId: 'project-1',
        priority: TaskPriority.MEDIUM,
      };
      const userId = 'user-1';
      const mockProject = { id: 'project-1' };
      const mockTask = { id: 'task-1', ...createTaskDto };

      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.task.create.mockResolvedValue(mockTask);
      cacheManager.get.mockResolvedValue(0);

      const result = await service.create(createTaskDto as any, userId);

      expect(prisma.project.findUnique).toHaveBeenCalledWith({ where: { id: 'project-1' } });
      expect(prisma.task.create).toHaveBeenCalledWith({ data: createTaskDto });
      expect(activityLogService.createLog).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalled();
      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException if project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.create({ projectId: 'invalid' } as any, 'u')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return cached tasks if available', async () => {
      const filters = { projectId: 'p1' };
      const cachedResult = { data: [], meta: {} };
      cacheManager.get.mockResolvedValueOnce(1); // version
      cacheManager.get.mockResolvedValueOnce(cachedResult); // data

      const result: any = await service.findAll(filters);

      expect(result).toEqual(cachedResult);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('should fetch and cache tasks if not in cache', async () => {
      const filters = { projectId: 'p1' };
      const mockData = [{ id: 't1' }];
      const mockTotal = 1;

      cacheManager.get.mockResolvedValue(null);
      prisma.task.findMany.mockResolvedValue(mockData);
      prisma.task.count.mockResolvedValue(mockTotal);

      const result: any = await service.findAll(filters);

      expect(result.data).toEqual(mockData);
      expect(result.meta.total).toBe(mockTotal);
      expect(cacheManager.set).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a task', async () => {
      const mockTask = { id: 't1' };
      prisma.task.findUnique.mockResolvedValue(mockTask);
      const result = await service.findOne('t1');
      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException if task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const id = 't1';
      const dto = { title: 'updated' };
      const userId = 'u1';
      const existingTask = { id, projectId: 'p1' };
      const updatedTask = { id, ...dto, projectId: 'p1' };

      prisma.task.findUnique.mockResolvedValue(existingTask);
      prisma.task.update.mockResolvedValue(updatedTask);

      const result = await service.update(id, dto, userId);

      expect(prisma.task.update).toHaveBeenCalledWith({ where: { id }, data: dto });
      expect(result).toEqual(updatedTask);
    });
  });

  describe('assignTask', () => {
    it('should assign a task', async () => {
      const taskId = 't1';
      const userId = 'u1';
      const actorId = 'a1';
      const task = { id: taskId, project: { workspaceId: 'w1' }, projectId: 'p1' };
      const workspace = { id: 'w1' };

      prisma.task.findUnique.mockResolvedValue(task);
      prisma.workspace.findFirst.mockResolvedValue(workspace);
      prisma.task.update.mockResolvedValue({ ...task, assigneeId: userId });

      const result = await service.assignTask(taskId, userId, actorId);

      expect(result.assigneeId).toBe(userId);
      expect(activityLogService.createLog).toHaveBeenCalledWith(taskId, actorId, 'ASSIGN', expect.any(String));
    });

    it('should throw BadRequestException if user not in workspace', async () => {
      prisma.task.findUnique.mockResolvedValue({ project: { workspaceId: 'w1' } });
      prisma.workspace.findFirst.mockResolvedValue(null);

      await expect(service.assignTask('t1', 'u1', 'a1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a task', async () => {
      const id = 't1';
      const userId = 'u1';
      const task = { id, title: 'Test', projectId: 'p1' };

      prisma.task.findUnique.mockResolvedValue(task);
      prisma.task.delete.mockResolvedValue(task);

      const result = await service.remove(id, userId);

      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id } });
      expect(result).toEqual(task);
    });
  });
});
