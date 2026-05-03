# DevBoard — Project Context

## Stack

- **Framework**: NestJS
- **ORM**: Prisma v7
- **Database**: PostgreSQL (Docker, port 5433)
- **Cache**: Redis (Docker, port 6380)
- **Auth**: JWT (coming in Phase 3)
- **Node**: v24

## Current Status

- ✅ Phase 1 — Environment Setup (complete)
- ✅ Phase 2 — Project Config & Database (complete)
- 🔄 Phase 3 — Auth Module (JWT) (in progress)
  - ✅ Generate AuthModule: nest g module auth
  - ✅ Generate UserModule: nest g module user
  - ✅ Define User model in schema.prisma (id, email, password, role, createdAt)
  - ⬜ Run first migration: npx prisma migrate dev --name init
  - ⬜ Install bcrypt for password hashing

## Key Decisions & Workarounds

### Prisma v7 — Breaking Changes

Prisma v7 is a breaking change from v5. Key differences:

- No `url` in `schema.prisma` datasource block
- URL is configured via `prisma.config.ts` (auto-generated at project root)
- `PrismaClient` requires an adapter or explicit config in constructor
- Standard NestJS Prisma patterns from tutorials DO NOT work

### Working Prisma Setup

**schema.prisma**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

**prisma.config.ts** (project root, auto-generated)

```typescript
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] },
});
```

**prisma.service.ts** — must use adapter-pg, plain super() does NOT work

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter } as any);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**Required packages for Prisma v7:**

```bash
npm install prisma @prisma/client @prisma/adapter-pg pg
npm install -D @types/pg
```

### Docker Ports

Local ports changed to avoid conflicts with existing local installations:

- PostgreSQL: `5433:5432`
- Redis: `6380:6379`

### tsconfig.json

Must use `commonjs`, not `nodenext`:

```json
"module": "commonjs",
"moduleResolution": "node"
```

### app.module.ts

```typescript
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
})
export class AppModule {}
```

## .env

```
DATABASE_URL="postgresql://devboard:devboard123@localhost:5433/devboard"
REDIS_HOST=localhost
REDIS_PORT=6380
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret_change_this
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
```

## Project Structure

```
devboard/
├── generated/
│   └── prisma/          ← Prisma generated client
├── prisma/
│   └── schema.prisma
├── prisma.config.ts     ← Prisma v7 config
├── src/
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   └── app.module.ts
├── docker-compose.yml
└── .env
```
