# Patientor

This is the server side code for the Patientor Typescript app. This app allows users to add and view patients.

## How It's Made:

**Backend:** Nodejs, Express, Typescript

## How to Run:

1. Fork the repository

2. In the project root directory, install dependencies:
   `npm install`

3. Copy `.env.example` to `.env`

4. Start Postgres:
   `docker compose up -d`

5. Create and seed the database:
   `npm run db:migrate`
   `npm run db:seed`

6. Run the server in development mode:
   `npm run dev`
