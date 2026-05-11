# DevBoard

DevBoard is a high-performance project management board backend built with **NestJS**, **Prisma v7**, **PostgreSQL**, and **Redis**.

## 🚀 Features

- **Authentication**: JWT-based auth with Access & Refresh tokens.
- **Workspaces & Projects**: Organize your tasks into workspaces and projects.
- **Task Management**: Full CRUD for tasks, assignments, and status tracking.
- **Activity Logs**: Automatic tracking of all task-related activities.
- **Caching**: Redis-based caching for optimized performance.
- **Infrastructure**: Ready-to-use Docker configuration for local development and production.

## 🛠 Tech Stack

- **Framework**: [NestJS](https://nestjs.com/)
- **ORM**: [Prisma v7](https://www.prisma.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Cache**: [Redis](https://redis.io/)
- **Language**: TypeScript

---

## 🚦 Getting Started

### Prerequisites

- **Node.js**: v24 or higher
- **Docker & Docker Compose**
- **npm** (comes with Node.js)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd devboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Copy the example environment file and adjust values if necessary:
   ```bash
   cp .env.example .env
   ```

### 🐳 Infrastructure (Docker)

Start the required services (PostgreSQL and Redis) using Docker Compose:

```bash
docker compose up -d
```

> [!IMPORTANT]
> - **PostgreSQL** is available on port `5433` (to avoid conflicts with local installations).
> - **Redis** is available on port `6380`.

### 🗄️ Database Setup (Prisma)

Since this project uses **Prisma v7**, the setup is slightly different from previous versions. The Prisma client is generated in a custom path (`generated/prisma`).

1. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

2. **Run Migrations**:
   ```bash
   npx prisma migrate dev
   ```

---

## 🏃 Running the App

### Development Mode
```bash
npm run start:dev
```

### Production Mode
```bash
npm run build
npm run start:prod
```

### Dockerized Full Stack
To run the entire application (including the NestJS app) inside Docker:
```bash
docker compose up --build
```

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

---

## 🏗 Project Structure

- `src/`: Application source code.
- `prisma/`: Database schema and migrations.
- `generated/`: Auto-generated Prisma client.
- `docker-compose.yml`: Infrastructure configuration.

---

## 📄 License

DevBoard is [UNLICENSED](LICENSE).
