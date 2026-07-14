# Run PostgreSQL with Docker

No local PostgreSQL install? Use Docker instead.

## Prerequisites

- [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)

## 1. Start a PostgreSQL container

Run this in PowerShell:

```powershell
docker run -d `
  --name homenet-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=homenet `
  -p 5432:5432 `
  postgres:17-alpine
```

This starts a PostgreSQL 17 container with:
- User: `postgres`
- Password: `postgres`
- Database: `homenet`
- Port: `5432` (maps to your host)

## 2. Set your DATABASE_URL

Copy `.env.example` to `.env` (if not done already):

```powershell
copy .env.example .env
```

Edit `.env` and set:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/homenet?schema=public"
```

## 3. Run Prisma migrations

```powershell
npx prisma migrate dev
```

## 4. Useful commands

| Action | Command |
|---|---|
| Stop container | `docker stop homenet-postgres` |
| Start container | `docker start homenet-postgres` |
| Remove container | `docker rm -f homenet-postgres` |
| View logs | `docker logs homenet-postgres` |
| Connect via psql | `docker exec -it homenet-postgres psql -U postgres -d homenet` |

## 5. Persist data (optional)

Add a volume mount to keep data between restarts:

```powershell
docker run -d `
  --name homenet-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=homenet `
  -p 5432:5432 `
  -v homenet_pgdata:/var/lib/postgresql/data `
  postgres:17-alpine
```
