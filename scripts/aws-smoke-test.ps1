param(
  [string] $BaseUrl,
  [string] $Path = "/api/v1/ping",
  [int] $TimeoutSeconds = 15,
  [switch] $DryRun,
  [switch] $Help
)

$ErrorActionPreference = "Stop"

function Write-Usage {
  Write-Host @"
Smoke test the deployed AWS ECS API through the ALB.

Usage:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-smoke-test.ps1 [-BaseUrl <url>] [-Path <path>] [-TimeoutSeconds <seconds>] [-DryRun]

Examples:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-smoke-test.ps1 -DryRun
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-smoke-test.ps1 -BaseUrl http://example-alb.amazonaws.com -DryRun
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-smoke-test.ps1 -BaseUrl http://example-alb.amazonaws.com -Path /api/v1/ping

When -BaseUrl is omitted, the script reads:
  terraform -chdir=infra/aws output -raw load_balancer_dns_name
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

function Get-TerraformLoadBalancerDnsName($awsInfraPath) {
  $dnsName = & terraform "-chdir=$awsInfraPath" output -raw load_balancer_dns_name

  if ($LASTEXITCODE -ne 0) {
    Fail "Could not read load_balancer_dns_name from Terraform outputs in infra/aws."
  }

  $dnsName = $dnsName.Trim()
  if ([string]::IsNullOrWhiteSpace($dnsName)) {
    Fail "Terraform output load_balancer_dns_name was empty."
  }

  return $dnsName
}

function Join-Url($baseUrl, $path) {
  $cleanBaseUrl = $baseUrl.Trim().TrimEnd("/")
  $cleanPath = $path.Trim()

  if ([string]::IsNullOrWhiteSpace($cleanPath)) {
    Fail "Path cannot be empty."
  }

  if (-not $cleanPath.StartsWith("/")) {
    $cleanPath = "/$cleanPath"
  }

  return "$cleanBaseUrl$cleanPath"
}

if ($Help) {
  Write-Usage
  exit 0
}

if ($TimeoutSeconds -lt 1) {
  Fail "TimeoutSeconds must be at least 1."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$awsInfraPath = Join-Path $repoRoot "infra/aws"

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  if ($DryRun) {
    Write-Host "[dry-run] Would read ALB DNS name with: terraform -chdir=infra/aws output -raw load_balancer_dns_name"
    $BaseUrl = "http://<load-balancer-dns-name>"
  }
  else {
    Require-Command "terraform"
    $dnsName = Get-TerraformLoadBalancerDnsName $awsInfraPath
    $BaseUrl = "http://$dnsName"
  }
}

$testUrl = Join-Url $BaseUrl $Path

Write-Host ""
Write-Host "Smoke testing AWS ECS API:"
Write-Host "  URL:     $testUrl"
Write-Host "  Timeout: $TimeoutSeconds seconds"
Write-Host ""

if ($DryRun) {
  Write-Host "[dry-run] Would send GET $testUrl"
  Write-Host "Dry run complete. No HTTP request was sent."
  exit 0
}

try {
  $response = Invoke-WebRequest -Uri $testUrl -Method Get -TimeoutSec $TimeoutSeconds
  Write-Host "Smoke test succeeded: GET $testUrl returned HTTP $($response.StatusCode)."
}
catch {
  $statusCode = $null

  if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
    $statusCode = [int] $_.Exception.Response.StatusCode
  }

  if ($statusCode) {
    Fail "Smoke test failed: GET $testUrl returned HTTP $statusCode."
  }

  Fail "Smoke test failed: GET $testUrl did not complete. $($_.Exception.Message)"
}
