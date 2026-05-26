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
