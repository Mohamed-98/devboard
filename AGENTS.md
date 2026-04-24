# DevBoard — Agent Instructions

## Dev Commands
- `npm run start:dev` — Start with watch mode (requires Docker running)
- `npm run build` — Production build
- `npm run lint` — Lint code
- `npm test` — Run unit tests

## Prerequisites
- Docker must be running (`docker compose up -d`)
- PostgreSQL: `localhost:5433` (not default 5432)
- Redis: `localhost:6380` (not default 6379)

## Prisma v7 (Critical)
Prisma v7 broke backward compatibility. Standard NestJS patterns do NOT work.

**Required setup in `src/prisma/prisma.service.ts`:**
```typescript
import { PrismaPg } from '@prisma/adapter-pg';

constructor() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  super({ adapter } as any);
}
```

Do NOT use `super()` with just URL — it will fail. Generated client lives in `generated/prisma/client`.

## tsconfig.json
Must use `commonjs` + `node` moduleResolution (not nodenext).