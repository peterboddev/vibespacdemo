#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Build Lambda Layer Script for PowerShell
    
.DESCRIPTION
    This script prepares the Lambda layer structure without requiring Docker.
    It creates the proper nodejs/node_modules directory structure that AWS Lambda expects.
    
.EXAMPLE
    .\build-lambda-layer.ps1
#>

$LayerDir = "layers/shared-dependencies"
$NodejsDir = Join-Path $LayerDir "nodejs"
$NodeModulesDir = Join-Path $NodejsDir "node_modules"

Write-Host "🔨 Building Lambda layer for shared dependencies..." -ForegroundColor Cyan

try {
    # Clean up existing nodejs directory
    if (Test-Path $NodejsDir) {
        Write-Host "🧹 Cleaning existing nodejs directory..." -ForegroundColor Yellow
        Remove-Item -Path $NodejsDir -Recurse -Force
    }

    # Create nodejs directory structure
    Write-Host "📁 Creating nodejs directory structure..." -ForegroundColor Green
    New-Item -Path $NodejsDir -ItemType Directory -Force | Out-Null

    # Install dependencies in the layer directory
    Write-Host "📦 Installing dependencies..." -ForegroundColor Green
    Push-Location $LayerDir
    
    # Set environment variable for production
    $env:NODE_ENV = "production"
    
    # Install production dependencies only
    npm ci --omit=dev --ignore-scripts
    
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed with exit code $LASTEXITCODE"
    }

    # Move node_modules to the correct location for Lambda
    Write-Host "📂 Moving node_modules to nodejs/ directory..." -ForegroundColor Green
    if (Test-Path "node_modules") {
        Move-Item -Path "node_modules" -Destination $NodeModulesDir
    }

    # Go back to root directory
    Pop-Location

    # Verify the layer structure
    Write-Host "✅ Verifying layer structure..." -ForegroundColor Green
    if (Test-Path $NodeModulesDir) {
        $packages = Get-ChildItem -Path $NodeModulesDir -Directory
        Write-Host "📋 Layer contains $($packages.Count) packages:" -ForegroundColor Cyan
        
        $packages | Select-Object -First 10 | ForEach-Object {
            Write-Host "   - $($_.Name)" -ForegroundColor Gray
        }
        
        if ($packages.Count -gt 10) {
            Write-Host "   ... and $($packages.Count - 10) more" -ForegroundColor Gray
        }
    }

    # Check layer size
    function Get-DirectorySize {
        param([string]$Path)
        
        $totalSize = 0
        Get-ChildItem -Path $Path -Recurse -File | ForEach-Object {
            $totalSize += $_.Length
        }
        return $totalSize
    }

    $layerSize = Get-DirectorySize -Path $NodejsDir
    $layerSizeMB = [math]::Round($layerSize / 1MB, 2)
    Write-Host "📏 Layer size: $layerSizeMB MB" -ForegroundColor Cyan

    if ($layerSize -gt 250MB) {
        Write-Host "⚠️  Warning: Layer size exceeds 250 MB limit for Lambda layers" -ForegroundColor Yellow
    }

    Write-Host "🎉 Lambda layer built successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Layer structure:" -ForegroundColor Cyan
    Write-Host "$LayerDir/"
    Write-Host "├── package.json"
    Write-Host "└── nodejs/"
    Write-Host "    └── node_modules/"
    Write-Host "        ├── @aws-sdk/"
    Write-Host "        ├── ioredis/"
    Write-Host "        ├── pg/"
    Write-Host "        └── ..."

} catch {
    Write-Host "❌ Error building Lambda layer: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}