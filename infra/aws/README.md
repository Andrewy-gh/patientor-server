# Patientor Server AWS Production Scaffold

This Terraform root is a narrow production scaffold for running the Patientor server on real AWS ECS Fargate. It is separate from `infra/floci`, which is local-only.

## What This Creates

- AWS provider configuration using the Terraform AWS provider 6.x
- ECR repository for the server image
- CloudWatch log group for ECS task logs
- RDS PostgreSQL instance in the private subnets
- Security group allowing ECS tasks to reach PostgreSQL on port `5432`
- Secrets Manager secret containing the ECS `DATABASE_URL`
- ECS cluster
- ECS task execution role with permission to pull images, write logs, and read the `DATABASE_URL` secret
- ECS task role for application runtime permissions
- Security groups for the ALB and ECS service
- Internet-facing Application Load Balancer
- Target group with `/api/v1/ping` health checks
- Fargate task definitions for the web service and one-off migrations
- ECS service for the web server

## Prerequisites

Create or provide these outside this root:

- VPC
- Public subnets for the ALB
- Private subnets for ECS tasks
- NAT or other outbound path for private tasks when `assign_public_ip = false`
- Any Route53, ACM, HTTPS listener, WAF, or CI/CD automation

## Image Flow

The task definition deploys:

```text
<ecr_repository_url>:<image_tag>
```

Push the production image to the ECR repository output by Terraform, then apply
with the tag to deploy. Tags are immutable, so use a unique tag per release.

## Database And Secrets

Terraform now owns the production PostgreSQL path for this scaffold:

- RDS PostgreSQL runs in `private_subnet_ids` and is not publicly accessible.
- The database security group only accepts PostgreSQL traffic from the ECS task
  security group.
- Terraform generates the database password, uses it for the RDS master user,
  and writes the complete app `DATABASE_URL` to Secrets Manager.
- ECS task definitions consume that secret as the `DATABASE_URL` environment
  variable.

Treat the Terraform state for this root as sensitive. The generated database
password is not printed as an output, but Terraform state necessarily contains
the password and the secret value it manages.

## First Deploy Runbook

This scaffold prepares the local pieces needed for a first AWS ECS production
deploy:

- Terraform for the ECS/Fargate runtime, ECR repository, ALB, task roles, logs,
  RDS database, Secrets Manager wiring, task definitions, and ECS service
- `terraform.tfvars.example` with the production inputs that must be supplied
- `scripts/aws-publish-server-image.ps1` to build `apps/server/Dockerfile`, log
  in to ECR, tag the image, and push it
- `scripts/aws-run-migrations.ps1` to run the one-off ECS migration task and
  require exit code `0`

Before applying against a real AWS account, confirm these prerequisites:

- AWS account and credentials with permission to manage ECR, ECS, IAM,
  CloudWatch Logs, EC2 security groups, load balancing, RDS, and Secrets Manager
- Existing VPC, public subnets for the ALB, and private subnets for ECS tasks
- Outbound network path for private ECS tasks when `assign_public_ip = false`
- Terraform, Docker, and AWS CLI installed locally
- Terraform initialized in this root

Safe first deploy sequence:

1. Copy `infra/aws/terraform.tfvars.example` to `infra/aws/terraform.tfvars`.
   Fill every placeholder, including `vpc_id`, subnets, and a unique
   `image_tag`. For a first deploy, set `desired_count = 0` so the service
   stays scaled down until migrations pass.
2. Initialize and review Terraform:

   ```powershell
   terraform -chdir=infra/aws init
   terraform -chdir=infra/aws plan
   ```

3. Apply Terraform with `desired_count = 0`. This creates the ECR repository,
   RDS database, `DATABASE_URL` secret, task definitions, and a scaled-down ECS
   service.

   ```powershell
   terraform -chdir=infra/aws apply
   ```

4. Build and push the server image with the same tag from `terraform.tfvars`:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-publish-server-image.ps1 -Tag <tag>
   ```

   If Terraform output is not available in the local checkout, pass the ECR
   repository URL explicitly:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-publish-server-image.ps1 -Tag <tag> -RepositoryUrl <account>.dkr.ecr.<region>.amazonaws.com/patientor-server
   ```

5. Run the one-off migration task. The helper reads Terraform outputs for the
   ECS cluster name, migration task definition ARN, private subnet IDs, and ECS
   service security group ID. The task receives `DATABASE_URL` from Secrets
   Manager, waits until it stops, and requires container exit code `0`.

   ```powershell
   pnpm aws:migrate
   ```

6. Set `desired_count` to the intended service count and apply again:

   ```powershell
   terraform -chdir=infra/aws apply
   ```

7. Smoke test the service with the ALB DNS output:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-smoke-test.ps1
   ```

For rollback, redeploy a previous immutable image tag that still exists in ECR:
set `image_tag` back to that tag, then run `terraform -chdir=infra/aws apply`.

## Current Limitations

- This root does not create the VPC, subnets, HTTPS certificates, Route53, WAF,
  CI/CD, or a helper script for the AWS migration task.
- RDS is a starter PostgreSQL instance, not a complete production database
  posture. Real AWS remains the source of truth for backups, restore testing,
  deletion protection, maintenance windows, performance sizing, and rollback
  behavior.
- AWS costs can accrue once resources are applied. NAT Gateway is a common
  production choice for private task egress, but it is not required by this root;
  avoid creating one unless that cost and network path are intentional. RDS also
  incurs cost while it exists.
- The ALB listener is HTTP-only in this scaffold. Add HTTPS before exposing real
  production traffic.

## Required Variables

```hcl
aws_region              = "us-east-1"
vpc_id                  = "vpc-..."
public_subnet_ids       = ["subnet-...", "subnet-..."]
private_subnet_ids      = ["subnet-...", "subnet-..."]
image_tag               = "..."
```

## Server Runtime

The container listens on port `3001` by default and receives:

- `DATABASE_URL` from Secrets Manager
- `PORT=3001`
- `NODE_ENV=production`
- Optional `TRACING_ENABLED`
- Optional `OTEL_EXPORTER_OTLP_ENDPOINT`

The ALB target group checks `GET /api/v1/ping`.

## Local Floci Parity

`infra/floci` is still the local rehearsal path for the deploy order:

1. Build or publish the local image.
2. Apply ECS resources with the service scaled down.
3. Run the one-off migration task.
4. Scale the service up.
5. Smoke test.

This AWS slice moves production RDS and Secrets Manager under Terraform first.
The local Floci root still uses Compose Postgres and plain ECS environment
variables for `DATABASE_URL` because that path is already proven. The next Floci
parity slice should verify whether Floci RDS and ECS secret injection can model
the same `DATABASE_URL` flow without breaking the working migration rehearsal.
