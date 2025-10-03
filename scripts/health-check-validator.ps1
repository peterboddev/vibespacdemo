#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Health Check Validator Script for PowerShell
    
.DESCRIPTION
    This script validates the health of the deployed application by calling
    the health check endpoint and verifying the response. It can be used
    in CI/CD pipelines for automated rollback decisions.
    
.PARAMETER HealthCheckUrl
    The URL of the health check endpoint to validate
    
.PARAMETER MaxRetries
    Maximum number of retry attempts (default: 3)
    
.PARAMETER RetryDelay
    Delay between retries in seconds (default: 5)
    
.PARAMETER Timeout
    Request timeout in seconds (default: 30)
    
.PARAMETER ExpectedStatus
    Expected health status (default: OK)
    
.EXAMPLE
    .\health-check-validator.ps1 -HealthCheckUrl "https://api.example.com/api/v1/health"
    
.EXAMPLE
    .\health-check-validator.ps1 -HealthCheckUrl "https://api.example.com/api/v1/health" -MaxRetries 5 -ExpectedStatus "DEGRADED"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$HealthCheckUrl,
    
    [Parameter(Mandatory = $false)]
    [int]$MaxRetries = 3,
    
    [Parameter(Mandatory = $false)]
    [int]$RetryDelay = 5,
    
    [Parameter(Mandatory = $false)]
    [int]$Timeout = 30,
    
    [Parameter(Mandatory = $false)]
    [string]$ExpectedStatus = "OK"
)

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    $originalColor = $Host.UI.RawUI.ForegroundColor
    $Host.UI.RawUI.ForegroundColor = $Color
    Write-Output $Message
    $Host.UI.RawUI.ForegroundColor = $originalColor
}

function Test-HealthCheck {
    param(
        [string]$Url,
        [int]$TimeoutSeconds
    )
    
    try {
        $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec $TimeoutSeconds -ErrorAction Stop
        
        return @{
            Success = $true
            StatusCode = 200
            Body = $response
            Timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    }
    catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        
        return @{
            Success = $false
            StatusCode = $statusCode
            Error = $_.Exception.Message
            Timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    }
}

function Test-HealthResponse {
    param(
        [object]$Result,
        [string]$ExpectedStatus
    )
    
    # Check if request was successful
    if (-not $Result.Success) {
        Write-ColorOutput "❌ HTTP request failed: $($Result.Error)" -Color "Red"
        return $false
    }
    
    # Check HTTP status code
    if ($Result.StatusCode -ne 200) {
        Write-ColorOutput "❌ HTTP status code: $($Result.StatusCode) (expected: 200)" -Color "Red"
        return $false
    }
    
    # Check response body structure
    if (-not $Result.Body -or -not ($Result.Body -is [PSCustomObject])) {
        Write-ColorOutput "❌ Invalid response body structure" -Color "Red"
        return $false
    }
    
    # Check overall status
    if ($Result.Body.status -ne $ExpectedStatus) {
        Write-ColorOutput "❌ Overall status: $($Result.Body.status) (expected: $ExpectedStatus)" -Color "Red"
        return $false
    }
    
    # Check individual service health
    if ($Result.Body.checks) {
        $failedChecks = @()
        
        foreach ($service in $Result.Body.checks.PSObject.Properties) {
            $serviceName = $service.Name
            $check = $service.Value
            
            if ($check.status -ne "healthy") {
                $failedChecks += "$serviceName`: $($check.status)"
            }
        }
        
        if ($failedChecks.Count -gt 0) {
            Write-ColorOutput "❌ Failed service checks: $($failedChecks -join ', ')" -Color "Red"
            return $false
        }
    }
    
    return $true
}

# Main execution
Write-ColorOutput "Starting health check validation for: $HealthCheckUrl" -Color "Cyan"

$validationSuccess = $false

for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
    Write-ColorOutput "Attempt $attempt/$MaxRetries" -Color "Yellow"
    
    $result = Test-HealthCheck -Url $HealthCheckUrl -TimeoutSeconds $Timeout
    
    if (Test-HealthResponse -Result $result -ExpectedStatus $ExpectedStatus) {
        Write-ColorOutput "✅ Health check passed" -Color "Green"
        Write-ColorOutput "Health status:" -Color "Green"
        Write-Output ($result.Body | ConvertTo-Json -Depth 10)
        $validationSuccess = $true
        break
    }
    else {
        Write-ColorOutput "❌ Health check failed" -Color "Red"
        if ($result.Body) {
            Write-ColorOutput "Health status:" -Color "Red"
            Write-Output ($result.Body | ConvertTo-Json -Depth 10)
        }
        
        if ($attempt -lt $MaxRetries) {
            Write-ColorOutput "Waiting $RetryDelay seconds before retry..." -Color "Yellow"
            Start-Sleep -Seconds $RetryDelay
        }
    }
}

if ($validationSuccess) {
    Write-ColorOutput "🎉 Health check validation completed successfully" -Color "Green"
    exit 0
}
else {
    Write-ColorOutput "💥 Health check validation failed after all retries" -Color "Red"
    exit 1
}