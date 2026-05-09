/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('TaskService Cache Test', () => {
  let service: TaskService;
  let cacheManager: any;
  let prisma: any;

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    prisma = {
      project: {
        findUnique: jest.fn(),
      },
      task: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
      workspace: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: { createLog: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  it('should hit the cache on second findAll call', async () => {
    const projectId = 'project-1';
    const filters = { projectId };
    const mockData = { data: [], meta: { total: 0, page: 1, lastPage: 0 } };

    // First call: MISS
    cacheManager.get.mockResolvedValueOnce(null); // version MISS
    cacheManager.get.mockResolvedValueOnce(null); // data MISS
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);

    await service.findAll(filters);

    expect(cacheManager.get).toHaveBeenCalledWith(
      `tasks:project:${projectId}:version`,
    );
    expect(cacheManager.set).toHaveBeenCalled(); // Should set the result

    // Second call: HIT
    cacheManager.get.mockResolvedValueOnce(0); // version HIT
    cacheManager.get.mockResolvedValueOnce(mockData); // data HIT

    const result = await service.findAll(filters);

    expect(result).toEqual(mockData);
    expect(prisma.task.findMany).toHaveBeenCalledTimes(1); // Only called once (on miss)
  });

  it('should invalidate cache on task creation', async () => {
    const projectId = 'project-1';
    const createTaskDto = { title: 'New Task', projectId };
    const userId = 'user-1';

    prisma.project.findUnique.mockResolvedValue({ id: projectId });
    prisma.task.create.mockResolvedValue({ id: 'task-1', projectId });
    cacheManager.get.mockResolvedValue(0); // Current version

    await service.create(createTaskDto, userId);

    expect(cacheManager.set).toHaveBeenCalledWith(
      `tasks:project:${projectId}:version`,
      1,
      86400000,
    );
  });
});
