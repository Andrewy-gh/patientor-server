# Local Floci Terraform

This folder is the first Terraform slice for the local Floci ECS deployment
flow. It manages the local ECS cluster, the server service task definition, the
one-off migration task definition, and the service.

## Fast Path

Run from PowerShell at the repo root:

```powershell
pnpm floci:up
pnpm floci:doctor
pnpm floci:tf:init
terraform -chdir=infra/floci plan -var "server_desired_count=0"
terraform -chdir=infra/floci apply -var "server_desired_count=0"
pnpm floci:migrate
pnpm floci:service:up
```

The doctor step checks the things that have caused slow failures before:

- Docker Desktop's Linux engine is reachable
- `patientor-floci` and `patientor-postgres` are running
- `http://localhost:4566` is reachable
- `patientor-server:local` exists
- AWS CLI test credentials are available inside the script

The migration step runs a separate ECS task definition named
`patientor-server-migrations`. It uses the same `patientor-server:local` image
and the same local Postgres `DATABASE_URL` as the service, but its container
command is:

```text
node build/src/db/migrate.js
```

That command is expected to be present in the production-built Docker image.
The web service task still starts with the image default command and does not
run migrations during normal container startup.

The first apply in the fast path sets `server_desired_count=0`. That registers
the ECS cluster and task definitions while keeping the web service scaled down
until after migrations pass.

To preview the one-off ECS command without starting a task:

```powershell
.\scripts\floci-run-migrations.ps1 -DryRun
```

For manual AWS CLI commands, dot-source the local environment helper first:

```powershell
. .\scripts\floci-env.ps1
```

Then verify the service:

```powershell
aws ecs describe-services `
  --cluster patientor-dev `
  --services patientor-server `
  --endpoint-url $env:AWS_ENDPOINT_URL `
  --region us-east-1
```

Expected service state after apply:

```text
desiredCount: 1
runningCount: 1
```

## Terraform File Policy

Track `.terraform.lock.hcl` so every agent uses the same provider selection.
Do not track `.terraform/`, `terraform.tfstate`, or `terraform.tfstate.*`;
those are local machine state.

## Scope

This slice intentionally uses the local Docker image `patientor-server:local`.
It does not build or push images, model ALB/ELB, manage RDS, manage the
temporary host-access proxy, or depend on ECR image metadata.

## Local Deploy Rehearsal Order

Use this order to keep the local path aligned with the intended production
shape:

1. Publish or build the local image as `patientor-server:local`.
2. Apply the Floci ECS Terraform slice with the web service scaled down:

   ```powershell
   terraform -chdir=infra/floci apply -var "server_desired_count=0"
   ```

3. Run the one-off migration task:

   ```powershell
   pnpm floci:migrate
   ```

4. Deploy the ECS service:

   ```powershell
   pnpm floci:service:up
   ```

5. Smoke test the service after the task is healthy.

The one-off migration task is deliberately separate from the service task. If
the migration fails, the helper exits non-zero and the service deploy should not
be treated as ready.

`pnpm floci:service:up` uses `aws ecs update-service` with the service name
instead of relying on Terraform for the local scale-up. This is a Floci-specific
workaround: Floci accepts the name-based update, while the Terraform provider's
ARN-based update can return `ServiceNotFoundException` in this local setup.
