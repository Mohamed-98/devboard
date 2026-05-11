import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from 'generated/prisma/client';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userService: any;
  let jwtService: any;
  let configService: any;
  let cacheManager: any;

  beforeEach(async () => {
    userService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a user', async () => {
      const registerDto = { email: 'test@example.com', password: 'password123' };
      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      userService.create.mockResolvedValue({
        id: 'user-1',
        email: registerDto.email,
        password: 'hashedPassword',
        role: Role.USER,
      });

      const result = await service.register(registerDto);

      expect(userService.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(userService.create).toHaveBeenCalledWith({
        email: registerDto.email,
        password: 'hashedPassword',
      });
      expect(result).toEqual({
        message: 'Account created successfully',
        user: {
          id: 'user-1',
          email: registerDto.email,
          role: Role.USER,
        },
      });
    });

    it('should throw ConflictException if email exists', async () => {
      const registerDto = { email: 'test@example.com', password: 'password123' };
      userService.findByEmail.mockResolvedValue({ id: 'user-1' });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should successfully login and return tokens', async () => {
      const loginDto = { email: 'test@example.com', password: 'password123' };
      const user = { id: 'user-1', email: 'test@example.com', password: 'hashedPassword', role: Role.USER };
      
      userService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedRt');
      jwtService.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');
      configService.get.mockImplementation((key: string) => key);

      const result = await service.login(loginDto);

      expect(userService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, user.password);
      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        message: 'Logged In successfully',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userService.findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'n@e.com', password: 'p' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password invalid', async () => {
      userService.findByEmail.mockResolvedValue({ password: 'h' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ email: 'n@e.com', password: 'p' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens if valid', async () => {
      const userId = 'user-1';
      const refreshToken = 'rt';
      const user = { id: userId, email: 't@e.com', role: Role.USER };
      
      cacheManager.get.mockResolvedValue('hashedRt');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      userService.findOne.mockResolvedValue(user);
      jwtService.signAsync.mockResolvedValueOnce('at-new').mockResolvedValueOnce('rt-new');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedRtNew');

      const result = await service.refreshTokens(userId, refreshToken);

      expect(result).toEqual({
        access_token: 'at-new',
        refresh_token: 'rt-new',
      });
      expect(cacheManager.set).toHaveBeenCalledWith(`rt:${userId}`, 'hashedRtNew', 604800000);
    });

    it('should throw if refresh token not in cache', async () => {
      cacheManager.get.mockResolvedValue(null);
      await expect(service.refreshTokens('u', 'r')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if refresh token does not match', async () => {
      cacheManager.get.mockResolvedValue('hashedRt');
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.refreshTokens('u', 'r')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if user not found', async () => {
      cacheManager.get.mockResolvedValue('hashedRt');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      userService.findOne.mockResolvedValue(null);
      await expect(service.refreshTokens('u', 'r')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete token from cache', async () => {
      const userId = 'user-1';
      const result = await service.logout(userId);
      expect(cacheManager.del).toHaveBeenCalledWith(`rt:${userId}`);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });
});
