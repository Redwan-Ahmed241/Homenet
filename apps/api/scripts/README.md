# Homenet API – Docker Helper Scripts Guide 🛠️

Welcome! This folder contains beginner-friendly interactive scripts (`.bat`) designed to automate Docker and database operations for the **Homenet NestJS API** and **PostgreSQL** setup.

Whether you are setting up the project for the first time, adding database migrations, or installing npm packages, these scripts handle the Docker commands for you under the hood.

---

## 📌 Quick Summary – "Which script do I run?"

| I want to... | Run this script | npm Command |
|---|---|---|
| Set up the project for the very first time | **`setup.bat`** | `npm run docker:setup` |
| Start the server for daily development | **`start.bat`** | `npm run docker:start` |
| Stop the server when I'm done working | **`stop.bat`** | `npm run docker:stop` |
| Create a new database migration (after editing `schema.prisma`) | **`migrate-create.bat`** | `npm run docker:migrate` |
| Apply database migrations added by a teammate (`git pull`) | **`migrate-apply.bat`** | *(Double-click `migrate-apply.bat`)* |
| Seed the database with default data | **`seed.bat`** | `npm run docker:seed` |
| Install a new npm package (e.g. `axios`) | **`npm-install.bat`** | `npm run docker:install` |
| Wipe the database completely & start fresh | **`db-wipe.bat`** | `npm run docker:wipe` |
| View live server or database logs | **`logs.bat`** | `npm run docker:logs` |

---

## 💡 How to Run the Scripts

You can run any script in **two simple ways**:

1. **Method 1 (File Explorer):** Navigate to `apps/api/scripts/` in Windows File Explorer and **double-click** any `.bat` file.
2. **Method 2 (Terminal):** Open a terminal in `apps/api` and run the `npm run docker:<name>` command.

---

## 🔍 Detailed Script Breakdown

---

### 1. `setup.bat` (First-Time Setup)
* **What it does step-by-step:**
  1. Checks if `.env` exists. If missing, it copies `.env.example` to `.env` and **pauses** so you can open `.env` and fill in secrets (such as JWT secret or Cloudinary API keys).
  2. Verifies that **Docker Desktop** is open and running on your PC.
  3. Builds the NestJS Docker image and starts PostgreSQL + NestJS in the background (`docker compose up --build -d`).
  4. Applies all existing database migrations (`npx prisma migrate dev`).
  5. Seeds the database with default data (roles, sample areas, properties).
* **When to use:** On a new computer or when setting up the project for the first time.
* **Result:** Your API will be live at `http://localhost:3000` and Swagger docs at `http://localhost:3000/api/docs`.

---

### 2. `start.bat` (Start Docker Stack)
* **What it does step-by-step:**
  1. Checks for `.env` file (creates it from `.env.example` if missing).
  2. Prompts you to select a start mode:
     - **Option 1 (Default):** Runs containers in the background (`-d`). Recommended for daily work so your terminal stays free.
     - **Option 2:** Runs containers in foreground mode showing live logs directly in the window.
     - **Option 3:** Rebuilds Docker containers from scratch (`--build`) before starting (useful if you changed `Dockerfile` or `package.json`).
* **When to use:** Every day when you start working on the project.

---

### 3. `stop.bat` (Stop Containers)
* **What it does step-by-step:**
  1. Prompts you to select how to stop:
     - **Option 1 (Default):** Stops containers safely (`docker compose down`). Your database data is saved.
     - **Option 2:** Stops containers AND deletes the database storage volume (`docker compose down -v`).
* **When to use:** When you finish working for the day or want to free up system RAM.

---

### 4. `migrate-create.bat` (Create & Apply New Migration)
* **What it does step-by-step:**
  1. Ensures the Docker stack is running (starts it automatically if stopped).
  2. Asks you to type a **migration name** (e.g., `add_property_status` or `user_profile_fields`).
  3. Runs `npx prisma migrate dev --name <migration_name>` inside the container.
  4. Prisma generates a new SQL migration file inside `prisma/migrations/`, updates your local database schema, and regenerates Prisma Client types.
* **When to use:** Whenever **you** edit `prisma/schema.prisma` to add/change models, fields, or relations.
* **Important:** Always commit the newly created files in `prisma/migrations/` to Git!

---

### 5. `migrate-apply.bat` (Apply Teammate Migrations)
* **What it does step-by-step:**
  1. Ensures Docker containers are running.
  2. Runs `npx prisma migrate dev` inside the container to detect and apply any pending SQL migration files.
* **When to use:** Right after running **`git pull`** if a teammate added new migration files to `prisma/migrations/`.

---

### 6. `seed.bat` (Seed Database Data)
* **What it does step-by-step:**
  1. Ensures Docker containers are running.
  2. Runs `npx prisma db seed` inside the container.
* **When to use:** If you need to re-populate standard initial data (e.g. admin roles, system permissions, sample property categories).

---

### 7. `npm-install.bat` (Install npm Packages)
* **What it does step-by-step:**
  1. Ensures Docker container is running.
  2. Asks for the **package name** you want to install (e.g., `axios` or `bcrypt`).
  3. Asks if it should be installed as a dev dependency (`y/n`).
  4. Runs `npm install` inside the container. This updates both `package.json` and `package-lock.json` on your computer.
  5. Asks if you want to rebuild the container (`y/n`) so the new package is baked into the Docker image.
* **When to use:** Whenever you need to install new npm packages.
* **Why use this script instead of host `npm install`?:** Docker containers run on Linux Node environments. Installing inside the container ensures binary dependencies (like `bcrypt` or Prisma engine) match the container environment properly.

---

### 8. `db-wipe.bat` (Wipe & Fresh Reset)
* **What it does step-by-step:**
  1. Displays a clear **warning** that all local database data will be deleted.
  2. Asks for confirmation (`y/n`).
  3. Deletes the PostgreSQL database volume (`docker compose down -v`).
  4. Restarts fresh containers (`docker compose up -d`).
  5. Re-applies all Prisma migrations from scratch and re-runs seed script.
* **When to use:** If your local database gets into a corrupted state, or you want to test the application from a clean slate.

---

### 9. `logs.bat` (View Live Logs)
* **What it does step-by-step:**
  1. Gives options to stream live logs:
     - **Option 1:** All services combined (`docker compose logs -f`)
     - **Option 2:** NestJS API container only (`homenet-service`)
     - **Option 3:** PostgreSQL database container only (`homenet-postgres-db`)
* **When to use:** When debugging errors, checking backend console outputs, or monitoring SQL operations.

---

## ❓ Frequently Asked Questions (FAQ)

### Q1: What if I get "Docker is not running"?
**Answer:** Open **Docker Desktop** on Windows and wait until the bottom-left icon turns green ("Engine running"). Then run the script again.

### Q2: What if port 3000 or 5432 is already in use?
**Answer:** Make sure you don't have another local instance of NestJS or PostgreSQL running outside of Docker (e.g. local PostgreSQL service running in Windows Services). Stop local services or close existing terminals.

### Q3: Do I need to manually run `docker compose exec` commands?
**Answer:** No! These `.bat` scripts wrap all necessary `docker compose exec` commands so you don't have to remember complex syntax.
