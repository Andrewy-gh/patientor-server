# AWS Cost And Cleanup Checklist

Use this checklist before applying `infra/aws` against a real AWS account and
again after any smoke test or trial deploy. The goal is simple: nobody should be
surprised by a running bill or by a cleanup step that destroys data.

## What Costs Money

- **RDS PostgreSQL** costs while the database instance exists. Storage,
  autoscaled storage, and retained backups also count. This root defaults to a
  small starter instance, but it is still a real database.
- **Application Load Balancer** costs while the ALB exists, even when the ECS
  service has `desired_count = 0`.
- **NAT Gateway** costs if the VPC provides one outside this Terraform root. It
  usually has hourly and data-processing charges. This root does not create it,
  so check the VPC separately.
- **Fargate running tasks** cost while service or migration tasks are running.
  `desired_count = 0` stops the web service tasks, but it does not remove the
  ALB, RDS database, ECR repository, CloudWatch log group, or other Terraform
  resources.
- **CloudWatch Logs** cost for log ingestion and retained log storage. Keep
  `log_retention_days` short for trials.
- **ECR image storage** costs for pushed container images while they remain in
  the repository.
- **RDS snapshots and final snapshots** can cost after the database is deleted.
  They are useful recovery points, but they are not free inventory.

## Before Apply

1. Confirm this is the right AWS account and region.
2. Decide whether this run is a learning smoke test or a production-shaped
   environment.
3. For a first deploy, set `desired_count = 0` so Terraform can create the
   service without starting web tasks before migrations pass.
4. Choose the networking path:
   - Public-subnet learning smoke test: `assign_public_ip = true`, using public
     subnet IDs for task subnets. This avoids NAT Gateway cost but is temporary.
   - Private-subnet deploy with NAT: `assign_public_ip = false`, with a NAT
     Gateway supplied by the VPC.
   - Private-subnet deploy without NAT: `assign_public_ip = false`, with VPC
     endpoints for ECR API, ECR Docker, S3, Secrets Manager, and CloudWatch
     Logs.
5. If NAT Gateway is used, confirm who owns that cost and cleanup because it is
   outside this Terraform root.
6. Keep `log_retention_days` low for trials, such as `7`.
7. Confirm whether RDS should keep deletion protection enabled. The default is
   `database_deletion_protection = true`, which blocks accidental database
   deletion.
8. Confirm the RDS final snapshot expectation. This root sets
   `skip_final_snapshot = false`, so a destroy creates a final snapshot when
   deletion protection has been turned off.
9. Run `terraform -chdir=infra/aws plan` and check for the cost-bearing
   resources above before approving the apply.

## During Testing

- Scale up only when needed. Set `desired_count = 1` for the first web smoke
  test, then scale back to `0` when the test is done.
- Run one-off migration tasks intentionally and wait for them to stop.
- Avoid pushing throwaway ECR tags repeatedly unless they will be cleaned up.
- Watch CloudWatch Logs during the test, but remember log ingestion and
  retention have cost.

## After Testing

Choose one of these cleanup paths before walking away.

### Keep The Environment, Stop Compute

Use this when you need the database, ALB DNS name, and Terraform-managed
resources to remain available for another test soon.

1. Set `desired_count = 0`.
2. Run `terraform -chdir=infra/aws apply`.
3. Confirm the ECS service has no running tasks.
4. Remember that RDS, ALB, ECR image storage, CloudWatch logs, snapshots, and
   any outside NAT Gateway can still cost money.

### Tear Down The Terraform Environment

Use this when the trial environment is no longer needed.

1. Decide whether the database needs a final snapshot.
2. If destroying RDS is intended, set `database_deletion_protection = false` and
   apply that change first.
3. Run `terraform -chdir=infra/aws destroy` only after confirming the plan
   removes the expected resources.
4. Record the final snapshot name if one is created. Delete it later when the
   recovery point is no longer needed.
5. Remove unused ECR images if the repository or images remain outside the
   destroy path.
6. Check for AWS resources this root did not create, especially NAT Gateway,
   VPC endpoints, Route53 records, ACM certificates, WAF rules, and manually
   created snapshots.

## Terraform Destroy Implications

Terraform destroy is a real data-destruction operation for resources managed by
this root. It can delete the ECS service, ALB, CloudWatch log group, Secrets
Manager secret, ECR repository, and RDS database after deletion protection is
disabled.

RDS is the main decision point. With `database_deletion_protection = true`,
destroy should be blocked for the database. With deletion protection disabled,
this root requests a final snapshot because `skip_final_snapshot = false`. That
protects against immediate total data loss, but the snapshot can continue to
cost money until it is deleted.

`desired_count = 0` is a cost reducer, not a cleanup. It stops steady web task
compute, but it does not delete the environment.
