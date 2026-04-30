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
    // Test setting a value in Redis with a TTL of 10 seconds
    await this.cacheManager.set('test_key', 'Redis connection is working!');
    
    // Test getting the value back
    const value = await this.cacheManager.get('test_key');
    
    return `${this.appService.getHello()} Cache value: ${value}`;
  }
}
