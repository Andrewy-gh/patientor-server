# Deploy Command Checklists

Use these checklists from PowerShell at the repo root. Run the Floci checklist
before trying the AWS checklist when you want a local rehearsal of the deploy
order.

## Floci Local Rehearsal

1. Build the local server image.

   ```powershell
   docker build -f apps/server/Dockerfile -t patientor-server:local .
   ```

2. Start the local Floci and Postgres services.

   ```powershell
   pnpm floci:up
   ```

3. Check the local prerequisites before Terraform runs.

   ```powershell
   pnpm floci:doctor
   ```

4. Initialize the local Terraform root.

   ```powershell
   pnpm floci:tf:init
   ```

5. Review the local ECS plan with the web service scaled down.

   ```powershell
   terraform -chdir=infra/floci plan -var "server_desired_count=0"
   ```

6. Apply the local ECS resources while keeping the web service down.

   ```powershell
   terraform -chdir=infra/floci apply -var "server_desired_count=0"
   ```

7. Run database migrations as a one-off ECS task.

   ```powershell
   pnpm floci:migrate
   ```

8. Scale the local ECS service up after migrations pass.

   ```powershell
   pnpm floci:service:up
   ```

9. Verify the backend from inside the ECS task container.

   ```powershell
   $server = docker ps --format "{{.Names}}" | Where-Object { $_ -match "floci-ecs-.*-server" } | Select-Object -First 1
   docker exec $server node -e "fetch('http://127.0.0.1:3001/api/v1/ping').then(async r => { console.log(r.status); console.log(await r.text()) })"
   ```

10. Optional: expose the local ECS task to the host when Windows Docker Desktop
    does not publish the task port.

    ```powershell
    docker rm -f patientor-ecs-proxy
    docker run -d --name patientor-ecs-proxy --network patientor-server_default -p 3001:3001 alpine/socat TCP-LISTEN:3001,fork,reuseaddr TCP:$($server):3001
    ```

11. Smoke test through the host proxy.

    ```powershell
    curl.exe http://localhost:3001/api/v1/ping
    ```

## AWS First Deploy

1. Choose the real AWS networking path.
   - Learning-only smoke deploy: put public subnet IDs in `private_subnet_ids`
     and set `assign_public_ip = true`. This avoids NAT Gateway cost, but tasks
     receive public IPs and the shape is temporary.
   - Production-common deploy: private subnets with `assign_public_ip = false`
     and NAT Gateway egress.
   - Private/no-NAT deploy: private subnets with `assign_public_ip = false` and
     VPC endpoints for ECR API, ECR Docker, S3, Secrets Manager, and CloudWatch
     Logs.

   Floci does not prove these network paths; this is an AWS-only proof point.

2. Copy and fill the AWS Terraform variables.

   ```powershell
   Copy-Item infra/aws/terraform.tfvars.example infra/aws/terraform.tfvars
   ```

   Set real values for `aws_region`, `vpc_id`, `public_subnet_ids`,
   `private_subnet_ids`, `assign_public_ip`, and `image_tag`. For the first
   deploy, keep `desired_count = 0` so the web service stays down until
   migrations pass.

3. Initialize the AWS Terraform root.

   ```powershell
   terraform -chdir=infra/aws init
   ```

4. Review the AWS plan before creating paid resources.

   ```powershell
   terraform -chdir=infra/aws plan
   ```

5. Apply the AWS scaffold with the web service scaled down.

   ```powershell
   terraform -chdir=infra/aws apply
   ```

   This creates ECR, RDS, Secrets Manager `DATABASE_URL`, ECS task definitions,
   the ALB, and an ECS service with `desired_count = 0`.

6. Build and push the server image to ECR.

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-publish-server-image.ps1 -Tag <tag>
   ```

7. Run the production migration as a one-off Fargate task.

   ```powershell
   pnpm aws:migrate
   ```

   The script reads the ECS cluster, migration task definition, task subnets,
   ECS service security group, and `assign_public_ip` from Terraform outputs.
   The task gets `DATABASE_URL` from AWS Secrets Manager and must exit with
   code `0`.

8. Scale the web service up by setting `desired_count` in
   `infra/aws/terraform.tfvars`.

   ```hcl
   desired_count = 1
   ```

9. Apply the service scale-up.

   ```powershell
   terraform -chdir=infra/aws apply
   ```

10. Smoke test through the ALB.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-smoke-test.ps1
```

11. Optional rollback: redeploy a previous immutable image tag.

    ```powershell
    terraform -chdir=infra/aws apply -var "image_tag=<previous-tag>"
    ```
