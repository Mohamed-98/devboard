import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Role } from 'generated/prisma/client';

describe('UserService Cache Test', () => {
  let service: UserService;
  let cacheManager: any;
  let prisma: any;

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should hit the cache on second findByEmail call', async () => {
    const email = 'test@example.com';
    const mockUser = { id: 'user-1', email, role: Role.USER };

    // First call: MISS
    cacheManager.get.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const result1 = await service.findByEmail(email);
    expect(result1).toEqual(mockUser);
    expect(cacheManager.set).toHaveBeenCalledWith(
      `user:email:${email}`,
      mockUser,
      3600000,
    );

    // Second call: HIT
    cacheManager.get.mockResolvedValueOnce(mockUser);

    const result2 = await service.findByEmail(email);
    expect(result2).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1); // Only once from first call
  });

  it('should invalidate cache on updateRole', async () => {
    const id = 'user-1';
    const email = 'test@example.com';
    const mockUser = { id, email, role: Role.ADMIN };

    prisma.user.update.mockResolvedValue(mockUser);

    await service.updateRole(id, Role.ADMIN);

    expect(cacheManager.del).toHaveBeenCalledWith(`user:id:${id}`);
    expect(cacheManager.del).toHaveBeenCalledWith(`user:email:${email}`);
  });
});
