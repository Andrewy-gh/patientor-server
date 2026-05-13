# Patientor

This is the server side code for the Patientor Typescript app. This app allows users to add and view patients.

## How It's Made:

**Backend:** Nodejs, Express, Typescript

## How to Run:

1. Fork the repository

2. In the project root directory, install dependencies:
   `pnpm install`

3. Copy `apps/server/.env.example` to `apps/server/.env`

4. Start Postgres:
   `docker compose up -d`

5. Create and seed the database:
   `pnpm --filter server db:migrate`
   `pnpm --filter server db:seed`

6. Run the server in development mode:
   `pnpm dev`
