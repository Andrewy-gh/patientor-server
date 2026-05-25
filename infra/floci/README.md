# Local Floci Terraform

This folder is the first Terraform slice for the local Floci ECS deployment
flow. It manages only the local ECS cluster, task definition, and service.

## Fast Path

Run from PowerShell at the repo root:

```powershell
pnpm floci:up
pnpm floci:doctor
pnpm floci:tf:init
pnpm floci:tf:plan
pnpm floci:tf:apply
```

The doctor step checks the things that have caused slow failures before:

- Docker Desktop's Linux engine is reachable
- `patientor-floci` and `patientor-postgres` are running
- `http://localhost:4566` is reachable
- `patientor-server:local` exists
- AWS CLI test credentials are available inside the script

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
It does not build or push images, model ALB/ELB, manage the temporary host-access
proxy, or depend on ECR image metadata.
