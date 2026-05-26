# Patientor

Patientor is organized as a pnpm monorepo.

## Apps

- `apps/server`: the existing Patientor server.

## Development

Install dependencies:

```bash
pnpm install
```

Run the server:

```bash
pnpm dev
```

Run the workspace checks:

```bash
pnpm ready
```

## Documentation

### Local Infrastructure

- [Floci Terraform quick path](./infra/floci/README.md): commands and
  preflight checks for the local ECS Terraform slice.
- [Floci ECR/ECS spike notes](./docs/floci-ecr-ecs-spike.md): Windows Docker
  Desktop findings, Floci limitations, and local ECS workarounds.
- [AWS ECS production scaffold](./infra/aws/README.md): first-deploy runbook
  and image publish flow for the production ECS/Fargate path.

### Product And App Setup

- [Frontend preparation](./docs/frontend-prep.md): how the monorepo shares API
  contracts with a future web app.

### Tutorials

- [Migrate server to HttpApi builder](./docs/tutorial-01-migrate-server-to-httpapi-builder.md)
- [Create the web app](./docs/tutorial-02-create-web-app.md)
- [Connect web to API](./docs/tutorial-03-connect-web-to-api.md)
- [Extract database package when needed](./docs/tutorial-04-extract-db-package-when-needed.md)

### Engineering Playbooks

- [Patientor Effect best practices](./.best-practices/README.md): the local
  Effect guidance and recommended reading order.
