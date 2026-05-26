param(
  [string] $Tag,
  [string] $RepositoryUrl,
  [string] $Region,
  [string] $LocalImageName,
  [switch] $DryRun,
  [switch] $Help
)

$ErrorActionPreference = "Stop"

function Write-Usage {
  Write-Host @"
Build and publish the server Docker image to AWS ECR.

Usage:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-publish-server-image.ps1 -Tag <tag> [-RepositoryUrl <url>] [-Region <region>] [-LocalImageName <name>] [-DryRun]

Examples:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-publish-server-image.ps1 -Tag 2026-05-26-abc123 -DryRun
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\aws-publish-server-image.ps1 -Tag 2026-05-26-abc123 -RepositoryUrl 123456789012.dkr.ecr.us-east-1.amazonaws.com/patientor-server

When -RepositoryUrl is omitted, the script reads:
  terraform -chdir=infra/aws output -raw ecr_repository_url
"@
}

function Fail($message) {
  throw $message
}

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Fail "$name is not available on PATH."
  }

  Write-Host "[ok] $name is available."
}

function Invoke-Native($failureMessage, $command, [string[]] $arguments) {
  & $command @arguments

  if ($LASTEXITCODE -ne 0) {
    Fail $failureMessage
  }
}

function Get-RepositoryRegion($repositoryUrl) {
  $hostName = ($repositoryUrl -split "/", 2)[0]

  if ($hostName -match "^\d{12}\.dkr\.ecr\.([a-z0-9-]+)\.") {
    return $Matches[1]
  }

  Fail "Could not infer AWS region from repository URL '$repositoryUrl'. Pass -Region explicitly."
}

function Get-RepositoryRegistry($repositoryUrl) {
  return ($repositoryUrl -split "/", 2)[0]
}

function Get-TerraformRepositoryUrl($awsInfraPath) {
  $repositoryUrl = & terraform "-chdir=$awsInfraPath" output -raw ecr_repository_url

  if ($LASTEXITCODE -ne 0) {
    Fail "Could not read ecr_repository_url from Terraform outputs in infra/aws."
  }

  $repositoryUrl = $repositoryUrl.Trim()
  if ([string]::IsNullOrWhiteSpace($repositoryUrl)) {
    Fail "Terraform output ecr_repository_url was empty."
  }

  return $repositoryUrl
}

if ($Help) {
  Write-Usage
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Tag)) {
  Write-Usage
  Fail "Tag is required. Example: -Tag 2026-05-26-abc123"
}

$Tag = $Tag.Trim()
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$awsInfraPath = Join-Path $repoRoot "infra/aws"
$dockerfilePath = Join-Path $repoRoot "apps/server/Dockerfile"

if (-not (Test-Path $dockerfilePath)) {
  Fail "Server Dockerfile was not found at $dockerfilePath."
}

if ([string]::IsNullOrWhiteSpace($LocalImageName)) {
  $LocalImageName = "patientor-server:$Tag"
}

Require-Command "docker"
Require-Command "aws"

if ([string]::IsNullOrWhiteSpace($RepositoryUrl)) {
  Require-Command "terraform"

  if ($DryRun) {
    Write-Host "[dry-run] Would read repository URL with: terraform -chdir=infra/aws output -raw ecr_repository_url"
    $RepositoryUrl = "<ecr-repository-url>"
  }
  else {
    $RepositoryUrl = Get-TerraformRepositoryUrl $awsInfraPath
  }
}

$RepositoryUrl = $RepositoryUrl.Trim().TrimEnd("/")

if ([string]::IsNullOrWhiteSpace($Region)) {
  if ($DryRun -and $RepositoryUrl -eq "<ecr-repository-url>") {
    $Region = "<aws-region>"
  }
  else {
    $Region = Get-RepositoryRegion $RepositoryUrl
  }
}

$registryUrl = Get-RepositoryRegistry $RepositoryUrl
$remoteImageName = "${RepositoryUrl}:$Tag"

Write-Host ""
Write-Host "Publishing server image:"
Write-Host "  Local image:  $LocalImageName"
Write-Host "  Remote image: $remoteImageName"
Write-Host "  Region:       $Region"
Write-Host ""

if ($DryRun) {
  Write-Host "[dry-run] docker build -f `"$dockerfilePath`" -t `"$LocalImageName`" `"$repoRoot`""
  Write-Host "[dry-run] aws ecr get-login-password --region `"$Region`" | docker login --username AWS --password-stdin `"$registryUrl`""
  Write-Host "[dry-run] docker tag `"$LocalImageName`" `"$remoteImageName`""
  Write-Host "[dry-run] docker push `"$remoteImageName`""
  Write-Host ""
  Write-Host "Dry run complete. No image was built, tagged, logged in, or pushed."
  exit 0
}

Invoke-Native "Docker build failed." "docker" @("build", "-f", $dockerfilePath, "-t", $LocalImageName, $repoRoot)

$loginPassword = & aws ecr get-login-password --region $Region
if ($LASTEXITCODE -ne 0) {
  Fail "AWS ECR login password lookup failed."
}

$loginPassword | docker login --username AWS --password-stdin $registryUrl
if ($LASTEXITCODE -ne 0) {
  Fail "Docker login to ECR failed."
}

Invoke-Native "Docker tag failed." "docker" @("tag", $LocalImageName, $remoteImageName)
Invoke-Native "Docker push failed." "docker" @("push", $remoteImageName)

Write-Host ""
Write-Host "Pushed $remoteImageName."
Write-Host "Next: deploy with Terraform using the same image tag:"
Write-Host "  terraform -chdir=infra/aws apply -var=`"image_tag=$Tag`""
