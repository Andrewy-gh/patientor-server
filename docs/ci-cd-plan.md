# CI/CD Plan

This plan describes the future GitHub Actions or equivalent pipeline for the
AWS ECS deploy path. It is intentionally a plan, not an enabled workflow. The
current production path should stay manual until the AWS networking choice,
Terraform state backend, release approvals, and rollback expectations are
settled.

## Product Behavior To Preserve

The pipeline must keep deploys boring and recoverable:

1. Prove the code is healthy before creating a release artifact.
2. Build exactly one server image for the release.
3. Push that image with an immutable tag.
4. Review Terraform changes before applying infrastructure changes.
5. Run database migrations as a one-off ECS task.
6. Scale or update the web service only after migrations pass.
7. Smoke test the deployed service.

The important safety rule is that normal web containers do not run database
migrations during startup. A failed migration should stop the deploy before the
service is scaled up to the new task definition.

## Proposed Pipeline Stages

### 1. Check

Run the same repo-defined gate used locally:

```powershell
pnpm check
pnpm test
pnpm build
```

`pnpm ready` already combines those steps. CI may run the commands separately
when separate status checks are easier to read.

### 2. Build Image

Build the server image from `apps/server/Dockerfile`.

Use a release tag that is unique to the source revision, such as the full Git
SHA. Do not use mutable tags such as `latest` for deploy decisions.

### 3. Push Immutable Image Tag

Log in to ECR and push:

```text
<account>.dkr.ecr.<region>.amazonaws.com/patientor-server:<git-sha>
```

The ECR repository is configured by `infra/aws`. The pipeline should treat the
tag as the release artifact that Terraform deploys.

### 4. Terraform Plan

Run Terraform against `infra/aws` with the image tag set to the new immutable
tag.

The plan should be visible before apply. For GitHub Actions, this usually means
publishing the plan as a job summary or artifact and requiring an environment
approval before the apply job.

### 5. Terraform Apply Or Manual Approval

Early automation should keep apply behind a manual approval. The apply updates
task definitions and infrastructure, but the first-deploy safety posture should
still support `desired_count = 0` until migrations pass.

The exact apply shape depends on the release policy:

- First deploy or risky infrastructure change: apply with `desired_count = 0`.
- Routine image-only deploy after the process is proven: apply the new task
  definition, run migrations, then scale/update the service.

Do not enable unattended apply until the team is comfortable with Terraform
state handling, cost impact, rollback steps, and who approves production
changes.

### 6. Run Migration Task

Run the one-off ECS migration task after Terraform apply and before service
scale-up. The existing helper, `scripts/aws-run-migrations.ps1`, already reads
Terraform outputs for the cluster, task definition, subnets, security group, and
public IP setting.

The migration task receives `DATABASE_URL` from AWS Secrets Manager through the
task definition. CI should not store or pass a `DATABASE_URL` secret.

The deploy must stop if the migration task exits with a non-zero code.

### 7. Scale Service

After migrations pass, scale the service to the intended count or apply the
Terraform change that sets `desired_count` to the intended count.

For the current manual path, this is still a deliberate separate step. A future
pipeline can automate it only after the manual path has succeeded repeatedly.

### 8. Smoke Test

Run the AWS smoke test after the service update finishes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-smoke-test.ps1
```

At minimum, the smoke test should verify `GET /api/v1/ping` through the ALB. A
later production readiness pass can add HTTPS and domain checks after the API
domain plan is implemented.

## Required Secrets And Permissions

Use short-lived AWS credentials where possible. For GitHub Actions, prefer OIDC
with an AWS IAM role instead of long-lived access keys.

The deploy role needs high-level permission to:

- Authenticate to AWS from CI.
- Push images to the ECR repository.
- Read Terraform state and write new state versions.
- Plan and apply the resources managed by `infra/aws`: ECR, ECS, IAM roles and
  policies, CloudWatch Logs, EC2 security groups, load balancing, RDS, and
  Secrets Manager.
- Run and describe ECS tasks for migrations.
- Update and describe the ECS service.
- Read Terraform outputs needed by the migration and smoke-test helpers.

Terraform state handling must be decided before CI apply is enabled. State is
sensitive because this root manages the generated RDS password and complete
Secrets Manager `DATABASE_URL` value. Use a locked remote backend such as S3
with DynamoDB or another approved Terraform backend before multiple humans or
CI jobs can apply the same root.

Do not add a CI `DATABASE_URL` secret. Terraform creates the production RDS
database, writes the application connection string to AWS Secrets Manager, and
wires ECS task definitions to that secret.

## What Should Stay Manual For Now

- Choosing the AWS networking path: public-subnet smoke deploy, private subnets
  with NAT Gateway, or private subnets with VPC endpoints.
- Reviewing Terraform plans that can create paid resources or alter production
  networking, database, IAM, or load-balancer behavior.
- Terraform apply until remote state, locking, approval ownership, and rollback
  expectations are settled.
- Running the first real AWS migration task and service scale-up, because this
  is the highest-risk moment for data and user availability.
- Rollback selection, because the team must choose the previous immutable image
  tag and decide whether rollback is safe after any migrations have run.

## Low-Risk Workflow Skeleton Later

When the manual AWS path has been proven, a low-risk first workflow can be
manual-only:

- Trigger: `workflow_dispatch`.
- Inputs: image tag or commit SHA, target environment, and whether to run
  plan-only or deploy.
- Default behavior: check, build, push image, and Terraform plan only.
- Protected deploy job: requires environment approval before Terraform apply,
  migration task, service scale-up, and smoke test.

Do not add scheduled deploys or push-to-main production deploys until the manual
approval path has a successful history.
