param(
  [switch] $DryRun,
  [switch] $Help,
  [int] $TimeoutSeconds = 600,
  [int] $PollSeconds = 10
)

$ErrorActionPreference = "Stop"

function Write-Usage {
  Write-Host @"
Run the production database migration as a one-off AWS ECS Fargate task.

Usage:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-run-migrations.ps1 [-TimeoutSeconds <seconds>] [-PollSeconds <seconds>] [-DryRun]

This script reads these Terraform outputs from infra/aws:
  ecs_cluster_name
  migration_task_definition_arn
  private_subnet_ids
  service_security_group_id
  assign_public_ip

The migration task receives DATABASE_URL from AWS Secrets Manager through the
ECS task definition. That DATABASE_URL points at the Terraform-managed RDS
PostgreSQL instance.
"@
}

function Fail($message) {
  throw $message
}

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Fail "$name is not available on PATH."
  }
}

function Invoke-External {
  param(
    [string] $Name,
    [string[]] $Arguments
  )

  $output = & $Name @Arguments 2>&1

  if ($LASTEXITCODE -ne 0) {
    $renderedOutput = ($output | Out-String).Trim()
    if (-not [string]::IsNullOrWhiteSpace($renderedOutput)) {
      Write-Host $renderedOutput
    }

    Fail "$Name command failed: $Name $($Arguments -join ' ')"
  }

  return $output
}

function Get-TerraformOutputRaw($awsInfraPath, $name) {
  $value = Invoke-External -Name "terraform" -Arguments @("-chdir=$awsInfraPath", "output", "-raw", $name)
  $value = ($value | Out-String).Trim()

  if ([string]::IsNullOrWhiteSpace($value)) {
    Fail "Terraform output $name was empty."
  }

  return $value
}

function Get-TerraformOutputJson($awsInfraPath, $name) {
  $json = Invoke-External -Name "terraform" -Arguments @("-chdir=$awsInfraPath", "output", "-json", $name)
  $json = ($json | Out-String).Trim()

  if ([string]::IsNullOrWhiteSpace($json)) {
    Fail "Terraform output $name was empty."
  }

  return $json | ConvertFrom-Json
}

function Get-MigrationSettings($awsInfraPath) {
  $privateSubnets = @(Get-TerraformOutputJson $awsInfraPath "private_subnet_ids")

  if ($privateSubnets.Count -eq 0) {
    Fail "Terraform output private_subnet_ids did not contain any subnets."
  }

  $assignPublicIpRaw = (Get-TerraformOutputRaw $awsInfraPath "assign_public_ip").ToLowerInvariant()
  if ($assignPublicIpRaw -ne "true" -and $assignPublicIpRaw -ne "false") {
    Fail "Terraform output assign_public_ip must be true or false."
  }

  $assignPublicIp = "DISABLED"
  if ($assignPublicIpRaw -eq "true") {
    $assignPublicIp = "ENABLED"
  }

  return [pscustomobject]@{
    Cluster = Get-TerraformOutputRaw $awsInfraPath "ecs_cluster_name"
    TaskDefinition = Get-TerraformOutputRaw $awsInfraPath "migration_task_definition_arn"
    SecurityGroup = Get-TerraformOutputRaw $awsInfraPath "service_security_group_id"
    PrivateSubnets = $privateSubnets
    AssignPublicIp = $assignPublicIp
  }
}

function Get-TaskExitCode($cluster, $taskArn) {
  $taskJson = Invoke-External -Name "aws" -Arguments @(
    "ecs", "describe-tasks",
    "--cluster", $cluster,
    "--tasks", $taskArn,
    "--output", "json"
  )

  $response = (($taskJson | Out-String).Trim() | ConvertFrom-Json)

  if ($response.failures -and @($response.failures).Count -gt 0) {
    $reason = @($response.failures)[0].reason
    Fail "Could not describe migration task $taskArn. AWS reported: $reason"
  }

  $task = @($response.tasks)[0]
  if ($null -eq $task) {
    Fail "AWS did not return migration task $taskArn."
  }

  $container = @($task.containers)[0]
  if ($null -eq $container) {
    Fail "Migration task $taskArn did not return container details."
  }

  return [pscustomobject]@{
    LastStatus = $task.lastStatus
    StoppedReason = $task.stoppedReason
    ContainerReason = $container.reason
    ExitCode = $container.exitCode
  }
}

if ($Help) {
  Write-Usage
  exit 0
}

if ($TimeoutSeconds -lt 1) {
  Fail "TimeoutSeconds must be at least 1."
}

if ($PollSeconds -lt 1) {
  Fail "PollSeconds must be at least 1."
}

Require-Command "aws"
Require-Command "terraform"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$awsInfraPath = Join-Path $repoRoot "infra/aws"

if ($DryRun) {
  Write-Host "[dry-run] Would read Terraform outputs from infra/aws:"
  Write-Host "  ecs_cluster_name"
  Write-Host "  migration_task_definition_arn"
  Write-Host "  private_subnet_ids"
  Write-Host "  service_security_group_id"
  Write-Host "  assign_public_ip"
  Write-Host ""
  Write-Host "[dry-run] Would call aws ecs run-task with the migration task definition."
  Write-Host "[dry-run] Would wait for the task to stop and require container exit code 0."
  exit 0
}

$settings = Get-MigrationSettings $awsInfraPath
$subnetList = $settings.PrivateSubnets -join ","
$networkConfiguration = "awsvpcConfiguration={subnets=[$subnetList],securityGroups=[$($settings.SecurityGroup)],assignPublicIp=$($settings.AssignPublicIp)}"

Write-Host ""
Write-Host "Running AWS ECS migration task:"
Write-Host "  Cluster:         $($settings.Cluster)"
Write-Host "  Task definition: $($settings.TaskDefinition)"
Write-Host "  Subnets:         $subnetList"
Write-Host "  Security group:  $($settings.SecurityGroup)"
Write-Host "  Assign public IP: $($settings.AssignPublicIp)"
Write-Host ""

$runTaskJson = Invoke-External -Name "aws" -Arguments @(
  "ecs", "run-task",
  "--cluster", $settings.Cluster,
  "--task-definition", $settings.TaskDefinition,
  "--launch-type", "FARGATE",
  "--network-configuration", $networkConfiguration,
  "--count", "1",
  "--output", "json"
)

$runTask = (($runTaskJson | Out-String).Trim() | ConvertFrom-Json)

if ($runTask.failures -and @($runTask.failures).Count -gt 0) {
  $failure = @($runTask.failures)[0]
  Fail "Migration task did not start. AWS reported: $($failure.reason) $($failure.detail)"
}

$taskArn = @($runTask.tasks)[0].taskArn
if ([string]::IsNullOrWhiteSpace($taskArn)) {
  Fail "AWS did not return a task ARN for the migration run."
}

Write-Host "Started migration task: $taskArn"

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$taskResult = $null

do {
  Start-Sleep -Seconds $PollSeconds
  $taskResult = Get-TaskExitCode $settings.Cluster $taskArn
  Write-Host "Task status: $($taskResult.LastStatus)"
} while ($taskResult.LastStatus -ne "STOPPED" -and (Get-Date) -lt $deadline)

if ($taskResult.LastStatus -ne "STOPPED") {
  Fail "Migration task did not stop within $TimeoutSeconds seconds."
}

if ($taskResult.ExitCode -ne 0) {
  Write-Host "Stopped reason: $($taskResult.StoppedReason)"
  Write-Host "Container reason: $($taskResult.ContainerReason)"
  Fail "Migration container exited with code $($taskResult.ExitCode)."
}

Write-Host "Migration task completed successfully with exit code 0."
