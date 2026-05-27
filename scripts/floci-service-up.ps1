param(
  [switch]$Help,
  [switch]$DryRun,
  [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"

if ($Help) {
  Write-Host "Scales the local Floci ECS service up after migrations pass."
  Write-Host ""
  Write-Host "Usage:"
  Write-Host "  .\scripts\floci-service-up.ps1 [-DryRun] [-TimeoutSeconds 120]"
  exit 0
}

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

function Invoke-Aws {
  param(
    [string[]]$Arguments
  )

  $output = & aws @Arguments

  if ($LASTEXITCODE -ne 0) {
    Fail "AWS CLI command failed: aws $($Arguments -join ' ')"
  }

  return $output
}

Require-Command "aws"

$env:AWS_ENDPOINT_URL = "http://localhost:4566"
$env:AWS_DEFAULT_REGION = "us-east-1"
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"

$cluster = "patientor-dev"
$service = "patientor-server"

if ($DryRun) {
  Write-Host ""
  Write-Host "Dry run only. This would run:"
  Write-Host "aws ecs update-service --cluster $cluster --service $service --desired-count 1 --endpoint-url $env:AWS_ENDPOINT_URL --region $env:AWS_DEFAULT_REGION"
  exit 0
}

Invoke-Aws -Arguments @(
  "ecs", "update-service",
  "--cluster", $cluster,
  "--service", $service,
  "--desired-count", "1",
  "--endpoint-url", $env:AWS_ENDPOINT_URL,
  "--region", $env:AWS_DEFAULT_REGION
) | Out-Null

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$ecsService = $null

do {
  Start-Sleep -Seconds 2

  $serviceJson = Invoke-Aws -Arguments @(
    "ecs", "describe-services",
    "--cluster", $cluster,
    "--services", $service,
    "--output", "json",
    "--endpoint-url", $env:AWS_ENDPOINT_URL,
    "--region", $env:AWS_DEFAULT_REGION
  )

  $response = $serviceJson | ConvertFrom-Json
  $ecsService = @($response.services)[0]

  if ($null -eq $ecsService) {
    Fail "Floci did not return ECS service $service."
  }

  Write-Host "Service counts: desired=$($ecsService.desiredCount), running=$($ecsService.runningCount), pending=$($ecsService.pendingCount)"
} while (($ecsService.runningCount -lt 1 -or $ecsService.desiredCount -lt 1) -and (Get-Date) -lt $deadline)

if ($ecsService.runningCount -lt 1) {
  Fail "ECS service did not reach runningCount=1 within $TimeoutSeconds seconds."
}

Pass "ECS service is running."
