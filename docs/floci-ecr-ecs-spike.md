# Floci ECR/ECS Local Spike Notes

This note captures the Windows Docker Desktop behavior found while spiking Floci
as a LocalStack replacement for the backend deploy path.

## Outcome

Floci is usable for the ECS spike, but the local ECR setup needs path-style
repository URIs and a small loopback proxy for Floci's ECR control plane.

Use this image reference in ECS task definitions:

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

## Loopback Proxy Workaround

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
image:

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

If the proxy already exists and needs to be recreated:

```powershell
docker rm -f floci-ecr-loopback
```

Then run the proxy command again.

## ECS Spike Guidance

This should not block the ECS spike.

Use the path-style image reference directly in the ECS task definition:

```text
localhost:5100/000000000000/us-east-1/patientor/server:local
```

Before running the ECS task, verify Docker can pull the exact image:

```powershell
docker pull localhost:5100/000000000000/us-east-1/patientor/server:local
```

Floci ECS creates Docker containers from the task definition image string. The
proxy is mainly needed for Floci's ECR API metadata calls, not for the host-side
Docker push itself.

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
`floci-ecr-loopback` is running.
