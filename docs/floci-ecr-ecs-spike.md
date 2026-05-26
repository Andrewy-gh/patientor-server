# Floci ECR/ECS Local Spike Notes

This note captures the Windows Docker Desktop behavior found while spiking Floci
as a LocalStack replacement for the backend deploy path.

## Outcome

Floci is usable for the ECS spike, but this Windows Docker Desktop setup needs
some non-standard wiring:

- path-style ECR repository URIs for Docker push/pull
- an ECR loopback proxy when troubleshooting Floci's ECR control plane
- an ECS host-access proxy when a task starts but its port is not published to
  the Windows host

For the ECS runtime spike, the most reliable image reference so far is the
local Docker image:

```text
patientor-server:local
```

For ECR push/pull testing, use this path-style image reference:

```text
localhost:5100/000000000000/us-east-1/patientor/server:local
```

Do not use hostname-style ECR references on this machine:

```text
000000000000.dkr.ecr.us-east-1.localhost:5100/patientor/server:local
```

Docker Desktop on this Windows setup did not resolve the
`*.dkr.ecr.*.localhost` hostname, while `localhost:5100` worked.

## Compose Requirements

The Floci service should keep path-style ECR URIs enabled:

```yaml
environment:
  FLOCI_HOSTNAME: localhost
  FLOCI_STORAGE_MODE: persistent
  FLOCI_STORAGE_PERSISTENT_PATH: /app/data
  FLOCI_SERVICES_DOCKER_NETWORK: patientor-server_default
  FLOCI_SERVICES_ECS_DOCKER_NETWORK: patientor-server_default
  FLOCI_SERVICES_ECR_DOCKER_NETWORK: patientor-server_default
  FLOCI_SERVICES_ECR_URI_STYLE: path
```

`FLOCI_SERVICES_ECR_URI_STYLE: path` makes Floci return repository URIs shaped
like:

```text
localhost:5100/000000000000/us-east-1/patientor/server
```

## Push Flow

Set the AWS CLI environment for Floci:

```powershell
$env:AWS_ENDPOINT_URL = "http://localhost:4566"
$env:AWS_DEFAULT_REGION = "us-east-1"
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
```

Create the ECR repository:

```powershell
aws ecr create-repository `
  --repository-name patientor/server `
  --endpoint-url $env:AWS_ENDPOINT_URL
```

Tag and push the local backend image:

```powershell
docker tag patientor-server:local `
  localhost:5100/000000000000/us-east-1/patientor/server:local

docker push `
  localhost:5100/000000000000/us-east-1/patientor/server:local
```

Verify the raw registry:

```powershell
curl.exe http://localhost:5100/v2/000000000000/us-east-1/patientor/server/tags/list
```

Expected response:

```json
{ "name": "000000000000/us-east-1/patientor/server", "tags": ["local"] }
```

## Why The Proxy Is Needed

Floci ECR has two local pieces:

- the AWS-shaped control plane at `http://localhost:4566`
- a real Docker registry sidecar at `localhost:5100`

Docker push/pull from the host can reach `localhost:5100`.

The issue is inside Floci itself. In Floci `1.5.18`, the ECR control plane's
registry HTTP client tries to enumerate tags from `http://localhost:5100`. When
Floci is running inside Docker, `localhost` means the Floci container, not the
registry sidecar. As a result, raw Docker registry operations work, but these AWS
ECR APIs can return empty results:

```powershell
aws ecr list-images `
  --repository-name patientor/server `
  --endpoint-url $env:AWS_ENDPOINT_URL

aws ecr describe-images `
  --repository-name patientor/server `
  --endpoint-url $env:AWS_ENDPOINT_URL
```

The Floci logs showed:

```text
ListImages registry query failed for patientor/server: null
DescribeImages tag enumeration failed for patientor/server: null
ECR reconcile-on-startup failed: null
```

## ECR Loopback Proxy Workaround

Run a small proxy in the Floci container's network namespace. It listens on
`localhost:5100` from Floci's point of view and forwards to Docker Desktop's host
view of the registry:

```powershell
docker run -d `
  --name floci-ecr-loopback `
  --network container:patientor-floci `
  alpine/socat `
  TCP-LISTEN:5100,fork,reuseaddr `
  TCP:host.docker.internal:5100
```

After this proxy is running, Floci's ECR control plane can enumerate the pushed
image if the registry path and Floci's internal registry lookup are aligned:

```powershell
aws ecr list-images `
  --repository-name patientor/server `
  --endpoint-url $env:AWS_ENDPOINT_URL `
  --region us-east-1

aws ecr describe-images `
  --repository-name patientor/server `
  --endpoint-url $env:AWS_ENDPOINT_URL `
  --region us-east-1
```

Expected result: both commands include the `local` image tag.

Observed caveat: if these commands still return empty image lists while the raw
registry has the tag, treat ECR metadata enumeration as unresolved and continue
the ECS spike with `patientor-server:local`. The raw registry path can still be
validated independently with:

```powershell
curl.exe http://localhost:5100/v2/000000000000/us-east-1/patientor/server/tags/list
```

If the proxy already exists and needs to be recreated:

```powershell
docker rm -f floci-ecr-loopback
```

Then run the proxy command again.

## ECS Spike Guidance

The ECR metadata issue should not block the ECS spike.

Use the local backend image directly in the ECS task definition:

```text
patientor-server:local
```

Before running the ECS task, verify Docker has the image:

```powershell
docker image inspect patientor-server:local
```

Floci ECS creates Docker containers from the task definition image string. The
proxy is mainly needed for Floci's ECR API metadata calls, not for the host-side
Docker push itself.

Register the task definition with a direct local image reference:

```powershell
aws ecs register-task-definition `
  --family patientor-server `
  --network-mode bridge `
  --container-definitions '[{"name":"server","image":"patientor-server:local","essential":true,"memory":512,"cpu":256,"environment":[{"name":"DATABASE_URL","value":"postgresql://patientor:patientor@postgres:5432/patientor"},{"name":"PORT","value":"3001"}],"portMappings":[{"containerPort":3001,"hostPort":3001,"protocol":"tcp"}]}]' `
  --endpoint-url $env:AWS_ENDPOINT_URL `
  --region us-east-1
```

Run one task:

```powershell
$taskArn = aws ecs run-task `
  --cluster patientor-dev `
  --task-definition patientor-server `
  --count 1 `
  --query 'tasks[0].taskArn' `
  --output text `
  --endpoint-url $env:AWS_ENDPOINT_URL `
  --region us-east-1

aws ecs describe-tasks `
  --cluster patientor-dev `
  --tasks $taskArn `
  --endpoint-url $env:AWS_ENDPOINT_URL `
  --region us-east-1
```

Expected ECS result:

```text
task lastStatus: RUNNING
container lastStatus: RUNNING
backend logs: Listening on http://0.0.0.0:3001
```

## Managed Service Recovery

After the one-off task works, create a managed ECS service so Floci owns the task
lifecycle:

```powershell
aws ecs create-service `
  --cluster patientor-dev `
  --service-name patientor-server `
  --task-definition patientor-server:1 `
  --desired-count 1 `
  --endpoint-url $env:AWS_ENDPOINT_URL `
  --region us-east-1
```

Expected service result:

```text
status: ACTIVE
desiredCount: 1
runningCount: 1
startedBy: ecs-svc
```

Stopping the service-owned task through the ECS API created a replacement task:

```powershell
aws ecs stop-task `
  --cluster patientor-dev `
  --task arn:aws:ecs:us-east-1:000000000000:task/patientor-dev/<task-id> `
  --endpoint-url $env:AWS_ENDPOINT_URL `
  --region us-east-1
```

Observed result:

```text
old task: STOPPED
new task: RUNNING
service desiredCount: 1
service runningCount: 1
new task startedBy: ecs-svc
```

This proves Floci can keep a service at desired count when tasks are stopped
through the ECS control plane.

## Terraform Local ECS Slice

The first local Terraform slice lives in `infra/floci`. It manages only the
local Floci ECS resources that are already proven:

- ECS cluster `patientor-dev`
- ECS task definition family `patientor-server`
- ECS service `patientor-server` with `desired_count = 1`

It intentionally uses the local Docker image `patientor-server:local` and does
not depend on ECR repository metadata. ECR list/describe image behavior is still
treated as unresolved for this spike, so Terraform should not use ECR image
lookups before creating or updating the ECS service.

Run it from PowerShell at the repo root. The doctor step checks that `docker`,
`terraform`, and `aws` are available, verifies Docker Desktop, the Compose
services, the Floci endpoint, and the local backend image, then sets the local
AWS CLI environment for that doctor run:

```powershell
pnpm floci:up
pnpm floci:doctor
pnpm floci:tf:init
pnpm floci:tf:plan
pnpm floci:tf:apply
```

For manual AWS CLI verification, set the local Floci environment first:

```powershell
. .\scripts\floci-env.ps1
```

Verify the service through Floci:

```powershell
aws ecs describe-services `
  --cluster patientor-dev `
  --services patientor-server `
  --endpoint-url http://localhost:4566 `
  --region us-east-1
```

Expected service state:

```text
desiredCount: 1
runningCount: 1
```

This Terraform slice does not model ALB/ELB, Docker image build/push, or the
temporary `patientor-ecs-proxy` host-access workaround. If the ECS task is
healthy but `curl.exe http://localhost:3001/api/v1/ping` fails from Windows,
continue using the proxy workflow below.

Track `infra/floci/.terraform.lock.hcl` for reproducible provider selection.
Keep local Terraform state and plugin directories ignored.

Important limitation: removing the underlying Docker container directly, for
example through Docker Desktop or `docker rm -f`, did not immediately reconcile
back into ECS task state. Docker no longer showed the container, but Floci still
reported the task as `RUNNING`.

Treat that as a Floci fidelity limitation, not a blocker for this local
production-shaped deploy spike. Real ECS owns container lifecycle inside AWS;
this local emulator is using Docker as an implementation detail. For this spike,
prefer ECS API operations (`stop-task`, `update-service`, `delete-service`) when
testing service behavior.

## ECS Host-Access Proxy Workaround

On this Windows Docker Desktop setup, Floci reported the ECS task port binding
as `0.0.0.0:3001`, but the actual Docker container only showed `3001/tcp` and
had no host `PortBindings`. As a result:

```powershell
curl.exe http://localhost:3001/api/v1/ping
```

failed from the host even though the backend was running inside Docker.

Verify the backend from inside the ECS task container:

```powershell
docker exec floci-ecs-<task-id>-server node -e "fetch('http://127.0.0.1:3001/api/v1/ping').then(async r => { console.log(r.status); console.log(await r.text()) })"
```

Expected response:

```text
200
"pong"
```

To expose the ECS task to the Windows host during the spike, run a temporary
`socat` proxy on the Compose network:

```powershell
docker run -d `
  --name patientor-ecs-proxy `
  --network patientor-server_default `
  -p 3001:3001 `
  alpine/socat `
  TCP-LISTEN:3001,fork,reuseaddr `
  TCP:floci-ecs-<task-id>-server:3001
```

After the proxy is running:

```powershell
curl.exe http://localhost:3001/api/v1/ping
```

Expected response:

```json
"pong"
```

If the ECS task is recreated, the generated `floci-ecs-<task-id>-server`
container name changes. Recreate the proxy with the new container name:

```powershell
docker rm -f patientor-ecs-proxy
```

Then run the proxy command again.

Treat this as a spike workaround, not the final production-shaped ingress model.
The next durable option to investigate is whether Floci should publish ECS task
ports itself or whether this spike should model host access through Floci
ELB/ALB.

## Healthcheck Form Note

The server Dockerfile uses Docker's exec-form `CMD` for the healthcheck:

```dockerfile
CMD ["node", "-e", "const port = process.env.PORT || '3001'; fetch('http://127.0.0.1:' + port + '/api/v1/ping').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
```

That form runs Node directly and avoids the shell entirely. The inline script
also builds the URL with string concatenation, so there are no JavaScript
template-literal backticks for `/bin/sh` to interpret before Node runs.

Keep that shape if the healthcheck changes. A `CMD-SHELL` string would let the
shell process backticks or `$()` before Node sees the script, which can turn the
URL into a shell command instead of a JavaScript string.

If health status needs to be checked during the spike, the backend can still be
verified with the `docker exec ... fetch(...)` command above or through the
`patientor-ecs-proxy` host-access proxy.

## Troubleshooting Checklist

Use PowerShell for local Docker Desktop, AWS CLI, Compose, ports, environment
variables, and container networking checks.

Check repository metadata:

```powershell
aws ecr describe-repositories `
  --repository-names patientor/server `
  --endpoint-url http://localhost:4566 `
  --region us-east-1
```

Expected `repositoryUri`:

```text
localhost:5100/000000000000/us-east-1/patientor/server
```

Check containers:

```powershell
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

Relevant containers:

- `patientor-floci`
- `floci-ecr-registry`
- `floci-ecr-loopback`, when using the workaround
- `floci-ecs-<task-id>-server`, when an ECS task is running
- `patientor-ecs-proxy`, when exposing an ECS task to the Windows host

Check networks:

```powershell
docker inspect patientor-floci --format '{{json .NetworkSettings.Networks}}'
docker inspect floci-ecr-registry --format '{{json .NetworkSettings.Networks}}'
```

Both Floci and the registry sidecar should be on `patientor-server_default`.

Check logs:

```powershell
docker logs --tail 200 patientor-floci
docker logs --tail 80 floci-ecr-registry
```

If `list-images` is empty but the raw registry has the tag, check that
`floci-ecr-loopback` is running. If it is running and the command still returns
empty, do not block the ECS runtime spike on ECR metadata enumeration.

If `curl.exe http://localhost:3001/api/v1/ping` fails but the ECS task is
running, check whether the task container has host port bindings:

```powershell
docker inspect floci-ecs-<task-id>-server --format '{{json .HostConfig.PortBindings}}'
```

If this returns `{}`, use or recreate `patientor-ecs-proxy`.
