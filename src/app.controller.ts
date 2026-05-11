import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get()
  async getHello(): Promise<string> {
    await this.cacheManager.set('test_key', 'Redis connection is working!');

    const value = await this.cacheManager.get<string>('test_key');

    return `${this.appService.getHello()} Cache value: ${value ?? 'No value found'}`;
  }
}
