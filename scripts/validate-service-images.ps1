[CmdletBinding()]
param(
    [string]$TagPrefix = "cn-banking",
    [string]$Tag = "local"
)

$ErrorActionPreference = "Stop"

$services = @(
    "api-gateway",
    "account-service",
    "transfer-service",
    "ledger-service",
    "fraud-service",
    "notification-service",
    "web-portal"
)

foreach ($service in $services) {
    $dockerfile = "services/$service/Dockerfile"
    $image = "$TagPrefix/$service`:$Tag"
    Write-Host "Building $image from $dockerfile"
    docker build -f $dockerfile -t $image .
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed for $service with exit code $LASTEXITCODE"
    }
}

Write-Host "All Phase 4 service images built successfully."
