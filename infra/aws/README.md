# Patientor Server AWS Production Scaffold

This Terraform root is a narrow production scaffold for running the Patientor server on real AWS ECS Fargate. It is separate from `infra/floci`, which is local-only.

## What This Creates

- AWS provider configuration using the Terraform AWS provider 6.x
- ECR repository for the server image
- CloudWatch log group for ECS task logs
- ECS cluster
- ECS task execution role with permission to pull images, write logs, and read the `DATABASE_URL` secret
- ECS task role for application runtime permissions
- Security groups for the ALB and ECS service
- Internet-facing Application Load Balancer
- Target group with `/api/v1/ping` health checks
- Fargate task definition and ECS service

## Prerequisites

Create or provide these outside this root:

- VPC
- Public subnets for the ALB
- Private subnets for ECS tasks
- NAT or other outbound path for private tasks when `assign_public_ip = false`
- Secrets Manager secret containing the production `DATABASE_URL`
- Any Route53, ACM, HTTPS listener, WAF, RDS, or database infrastructure

## Image Flow

The task definition deploys:

```text
<ecr_repository_url>:<image_tag>
```

Push the production image to the ECR repository output by Terraform, then apply
with the tag to deploy. Tags are immutable, so use a unique tag per release.

## First Deploy Runbook

This scaffold prepares the local pieces needed for a first AWS ECS production
deploy:

- Terraform for the ECS/Fargate runtime, ECR repository, ALB, task roles, logs,
  task definition, and ECS service
- `terraform.tfvars.example` with the production inputs that must be supplied
- `scripts/aws-publish-server-image.ps1` to build `apps/server/Dockerfile`, log
  in to ECR, tag the image, and push it

Before applying against a real AWS account, confirm these prerequisites:

- AWS account and credentials with permission to manage ECR, ECS, IAM,
  CloudWatch Logs, EC2 security groups, and load balancing
- Existing VPC, public subnets for the ALB, and private subnets for ECS tasks
- Outbound network path for private ECS tasks when `assign_public_ip = false`
- Secrets Manager secret whose value is the production `DATABASE_URL`
- Terraform, Docker, and AWS CLI installed locally
- Terraform initialized in this root

Safe first deploy sequence:

1. Copy `infra/aws/terraform.tfvars.example` to `infra/aws/terraform.tfvars`.
   Fill every placeholder, including `vpc_id`, subnets,
   `database_url_secret_arn`, and a unique `image_tag`.
2. Initialize and review Terraform:

   ```powershell
   terraform -chdir=infra/aws init
   terraform -chdir=infra/aws plan
   ```

3. Apply enough Terraform to create the ECR repository before publishing the
   first image. A full ECS deploy needs an image tag that already exists in ECR,
   so use a targeted apply for the repository when bootstrapping:

   ```powershell
   terraform -chdir=infra/aws apply -target=aws_ecr_repository.app
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

5. Apply Terraform with the same `image_tag` to create or update the runtime:

   ```powershell
   terraform -chdir=infra/aws apply
   ```

6. Smoke test the service with the ALB DNS output:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-smoke-test.ps1
   ```

For rollback, redeploy a previous immutable image tag that still exists in ECR:
set `image_tag` back to that tag, then run `terraform -chdir=infra/aws apply`.

## Current Limitations

- This root does not create RDS, the VPC, subnets, HTTPS certificates, Route53,
  WAF, CI/CD, or database migration automation.
- AWS costs can accrue once resources are applied. NAT Gateway is a common
  production choice for private task egress, but it is not required by this root;
  avoid creating one unless that cost and network path are intentional.
- The ALB listener is HTTP-only in this scaffold. Add HTTPS before exposing real
  production traffic.

## Required Variables

```hcl
aws_region              = "us-east-1"
vpc_id                  = "vpc-..."
public_subnet_ids       = ["subnet-...", "subnet-..."]
private_subnet_ids      = ["subnet-...", "subnet-..."]
image_tag               = "..."
database_url_secret_arn = "arn:aws:secretsmanager:..."
```

## Server Runtime

The container listens on port `3001` by default and receives:

- `DATABASE_URL` from Secrets Manager
- `PORT=3001`
- `NODE_ENV=production`
- Optional `TRACING_ENABLED`
- Optional `OTEL_EXPORTER_OTLP_ENDPOINT`

The ALB target group checks `GET /api/v1/ping`.
