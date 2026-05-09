import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role, User } from 'generated/prisma/client';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async updateRole(id: string, role: Role) {
    const updatedUser = await this.prisma.user.update({ where: { id }, data: { role } });
    await this.invalidateUserCache(updatedUser);
    return updatedUser;
  }

  async create(data: Prisma.UserCreateInput) {
    try {
      return await this.prisma.user.create({ data });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const cacheKey = `user:email:${email}`;
    const cached = await this.cacheManager.get<User>(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      await this.cacheManager.set(cacheKey, user, 3600000); // 1 hour
    }
    return user;
  }

  findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: string): Promise<User | null> {
    const cacheKey = `user:id:${id}`;
    const cached = await this.cacheManager.get<User>(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (user) {
      await this.cacheManager.set(cacheKey, user, 3600000); // 1 hour
    }
    return user;
  }

  async remove(id: string) {
    const user = await this.prisma.user.delete({ where: { id } });
    await this.invalidateUserCache(user);
    return user;
  }

  private async invalidateUserCache(user: any) {
    if (!user) return;
    await Promise.all([
      this.cacheManager.del(`user:id:${user.id}`),
      this.cacheManager.del(`user:email:${user.email}`),
    ]);
  }
}
