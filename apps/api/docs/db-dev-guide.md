# Database Development Guide

This guide provides instructions for setting up, configuring, and managing the PostgreSQL database for the Homenet API using Prisma.

---

## 1. Install PostgreSQL

To run the database locally, you need to install PostgreSQL:

- **Download Installer:** Visit the [EnterpriseDB PostgreSQL Downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads?utm_source=chatgpt.com) page.
- **Default Port:** `5432`
- **Default User:** `postgres`

> [!NOTE]
> During installation, remember the password you set for the default `postgres` user. You will need it for the environment configuration.

---

## 2. Environment Configuration

The application reads database connection details from the `.env` file at the root of `apps/api`.

### Steps:

1. Copy the template from `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Update the `DATABASE_URL` variable inside `.env` to match your database credentials:
   ```env
   DATABASE_URL="postgresql://<username>:<password>@localhost:5432/homenet?schema=public"
   ```

### Parameter Breakdown:

- `postgresql://` – Connection protocol.
- `<username>` – Database user (e.g., `postgres`).
- `<password>` – Database password (the password you configured during installation).
- `localhost:5432` – Database host and port.
- `<database_name>` – The name of your database (e.g., `homenet`).
- `?schema=public` – Default schema to use in PostgreSQL.

---

## 3. Database Migrations

Prisma uses migration files to keep your database schema synchronized with the `prisma/schema.prisma` file.

### Apply Migrations and Generate Prisma Client

Whenever you update `schema.prisma` or set up the database for the first time, run the migration command:

```bash
# Detect schema changes, prompt for a name, and apply migration
npx prisma migrate dev

# Or directly supply a migration name:
npx prisma migrate dev --name <migration_name>
```

**Example:**

```bash
npx prisma migrate dev --name init
```

This command will:

1. Create a new SQL migration file in the `prisma/migrations` folder.
2. Run the SQL migration against your PostgreSQL database.
3. Automatically generate the Prisma Client types.

---

## 4. Visualizing Data with Prisma Studio

Prisma Studio is a built-in visual editor for your database. It allows you to view, add, edit, and delete records easily.

To start Prisma Studio, run:

```bash
npx prisma studio
```

Once running, open your browser and navigate to:

- [http://localhost:5555](http://localhost:5555)

---

## 5. Cheat Sheet

| Task                                 | Command                                |
| :----------------------------------- | :------------------------------------- |
| **Validate and format schema file**  | `npx prisma format`                    |
| **Apply changes & create migration** | `npx prisma migrate dev`               |
| **Create named migration**            | `npx prisma migrate dev --name <name>` |
| **Open visual database GUI**         | `npx prisma studio`                    |
