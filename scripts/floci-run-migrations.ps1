param(
  [switch]$Help,
  [switch]$DryRun,
  [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"

if ($Help) {
  Write-Host "Runs the Patientor server database migration as a one-off Floci ECS task."
  Write-Host ""
  Write-Host "Usage:"
  Write-Host "  .\scripts\floci-run-migrations.ps1 [-DryRun] [-TimeoutSeconds 120]"
  Write-Host ""
  Write-Host "Options:"
  Write-Host "  -DryRun           Validate prerequisites and print the ECS run-task command."
  Write-Host "  -TimeoutSeconds   Maximum seconds to wait for the task to stop. Default: 120."
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

function Get-TaskDefinitionArn($family) {
  $arn = & aws @(
    "ecs", "describe-task-definition",
    "--task-definition", $family,
    "--query", "taskDefinition.taskDefinitionArn",
    "--output", "text",
    "--endpoint-url", $env:AWS_ENDPOINT_URL,
    "--region", $env:AWS_DEFAULT_REGION
  )

  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($arn) -or $arn.Trim() -eq "None") {
    Fail "ECS task definition $family is missing. Run pnpm floci:tf:apply first."
  }

  return $arn.Trim()
}

function Get-TaskId($taskArn) {
  return ($taskArn.Trim() -split "/")[-1]
}

function Get-FlociContainerState($taskArn) {
  $taskId = Get-TaskId $taskArn
  $containerName = "floci-ecs-$taskId-migrations"
  $state = docker inspect $containerName --format "{{.State.Status}}|{{.State.ExitCode}}|{{.State.Error}}" 2>$null

  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($state)) {
    return $null
  }

  $parts = $state.Trim() -split "\|", 3

  return [pscustomobject]@{
    Name = $containerName
    Status = $parts[0]
    ExitCode = [int]$parts[1]
    Error = if ($parts.Length -gt 2) { $parts[2] } else { "" }
  }
}

Require-Command "aws"
Require-Command "docker"
Require-Command "terraform"

Require-RunningContainer "patientor-floci"
Require-RunningContainer "patientor-postgres"

if (-not (Test-HttpReachable "http://localhost:4566")) {
  Fail "Floci is not reachable at http://localhost:4566."
}
Pass "Floci endpoint is reachable at http://localhost:4566."

docker image inspect patientor-server:local 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Fail "Docker image patientor-server:local is missing. Build it before running migrations."
}
Pass "Docker image patientor-server:local exists."

$env:AWS_ENDPOINT_URL = "http://localhost:4566"
$env:AWS_DEFAULT_REGION = "us-east-1"
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"

$cluster = "patientor-dev"
$family = "patientor-server-migrations"
$taskDefinitionArn = Get-TaskDefinitionArn $family

Pass "Found migration task definition: $taskDefinitionArn"

if ($DryRun) {
  Write-Host ""
  Write-Host "Dry run only. This would run:"
  Write-Host "aws ecs run-task --cluster $cluster --task-definition $family --count 1 --endpoint-url $env:AWS_ENDPOINT_URL --region $env:AWS_DEFAULT_REGION"
  exit 0
}

$taskArn = Invoke-Aws -Arguments @(
  "ecs", "run-task",
  "--cluster", $cluster,
  "--task-definition", $family,
  "--count", "1",
  "--query", "tasks[0].taskArn",
  "--output", "text",
  "--endpoint-url", $env:AWS_ENDPOINT_URL,
  "--region", $env:AWS_DEFAULT_REGION
)

$taskArn = $taskArn.Trim()
if ([string]::IsNullOrWhiteSpace($taskArn) -or $taskArn -eq "None") {
  Fail "Floci did not return a task ARN for the migration run."
}

Write-Host "Started migration task: $taskArn"

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$task = $null

do {
  Start-Sleep -Seconds 2

  $flociContainer = Get-FlociContainerState $taskArn
  if ($null -ne $flociContainer -and $flociContainer.Status -eq "exited") {
    if ($flociContainer.ExitCode -ne 0) {
      if (-not [string]::IsNullOrWhiteSpace($flociContainer.Error)) {
        Write-Host "Docker container error: $($flociContainer.Error)"
      }

      Fail "Migration container $($flociContainer.Name) exited with code $($flociContainer.ExitCode)."
    }

    Pass "Migration task completed successfully."
    exit 0
  }

  $taskJson = Invoke-Aws -Arguments @(
    "ecs", "describe-tasks",
    "--cluster", $cluster,
    "--tasks", $taskArn,
    "--output", "json",
    "--endpoint-url", $env:AWS_ENDPOINT_URL,
    "--region", $env:AWS_DEFAULT_REGION
  )

  $response = $taskJson | ConvertFrom-Json
  $task = @($response.tasks)[0]

  if ($null -eq $task) {
    Fail "Floci did not return the migration task in describe-tasks."
  }

  Write-Host "Task status: $($task.lastStatus)"
} while ($task.lastStatus -ne "STOPPED" -and (Get-Date) -lt $deadline)

if ($task.lastStatus -ne "STOPPED") {
  Fail "Migration task did not stop within $TimeoutSeconds seconds."
}

$container = @($task.containers)[0]
if ($null -eq $container) {
  Fail "Migration task stopped without container details."
}

if ($container.exitCode -ne 0) {
  Write-Host "Stopped reason: $($task.stoppedReason)"
  Write-Host "Container reason: $($container.reason)"
  Fail "Migration container exited with code $($container.exitCode)."
}

Pass "Migration task completed successfully."
