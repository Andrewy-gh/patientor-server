$ErrorActionPreference = "Continue"

function Pass($message) {
  Write-Host "[ok] $message"
}

function Fail($message) {
  Write-Host "[fail] $message" -ForegroundColor Red
  exit 1
}

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Fail "$name is not available on PATH."
  }

  Pass "$name is available."
}

function Require-RunningContainer($name) {
  $running = docker inspect --format "{{.State.Running}}" $name 2>$null

  if ($LASTEXITCODE -ne 0) {
    Fail "$name is missing. Run pnpm floci:up first."
  }

  if ($running.Trim() -ne "true") {
    Fail "$name is not running. Run pnpm floci:up first."
  }

  Pass "$name is running."
}

function Test-HttpReachable($url) {
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop | Out-Null
    return $true
  }
  catch {
    $response = $_.Exception.Response
    if ($null -ne $response) {
      return $true
    }

    return $false
  }
}

Require-Command "docker"
Require-Command "terraform"
Require-Command "aws"

$dockerVersion = docker version --format "{{.Server.Version}}" 2>$null
if ($LASTEXITCODE -ne 0) {
  Fail "Docker Desktop Linux engine is not reachable. Start Docker Desktop and retry."
}
Pass "Docker Desktop Linux engine is reachable: $($dockerVersion.Trim())."

Require-RunningContainer "patientor-floci"
Require-RunningContainer "patientor-postgres"

if (-not (Test-HttpReachable "http://localhost:4566")) {
  Fail "Floci is not reachable at http://localhost:4566."
}
Pass "Floci endpoint is reachable at http://localhost:4566."

docker image inspect patientor-server:local 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Fail "Docker image patientor-server:local is missing. Build it before applying the ECS slice."
}
Pass "Docker image patientor-server:local exists."

$env:AWS_ENDPOINT_URL = "http://localhost:4566"
$env:AWS_DEFAULT_REGION = "us-east-1"
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
Pass "AWS CLI environment is set for this doctor run."

Write-Host ""
Write-Host "Local Floci prerequisites look ready. Next: pnpm floci:tf:plan"
