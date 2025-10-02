# CDK Bootstrap Script for Insurance Quotation Application (PowerShell)
# This script helps set up CDK for different environments

param(
    [string]$Environment = $(if ($env:ENVIRONMENT) { $env:ENVIRONMENT } else { "dev" }),
    [string]$Region = $(if ($env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION } else { "us-east-1" }),
    [string]$Account = $env:CDK_DEFAULT_ACCOUNT
)

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"

Write-Host "Insurance Quotation CDK Bootstrap Script" -ForegroundColor $Green
Write-Host "==========================================" -ForegroundColor $Green

# Check if AWS CLI is installed
try {
    $awsVersion = aws --version 2>$null
    if (-not $awsVersion) {
        throw "AWS CLI not found"
    }
    Write-Host "AWS CLI found: $awsVersion" -ForegroundColor $Green
} catch {
    Write-Host "Error: AWS CLI is not installed. Please install it first." -ForegroundColor $Red
    exit 1
}

# Check if CDK is installed
try {
    $cdkVersion = cdk --version 2>$null
    if (-not $cdkVersion) {
        throw "CDK not found"
    }
    Write-Host "CDK found: $cdkVersion" -ForegroundColor $Green
} catch {
    Write-Host "Error: AWS CDK is not installed. Installing it now..." -ForegroundColor $Red
    npm install -g aws-cdk
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install CDK" -ForegroundColor $Red
        exit 1
    }
}

# Get AWS account ID if not provided
if (-not $Account) {
    Write-Host "Getting AWS account ID..." -ForegroundColor $Yellow
    try {
        $Account = aws sts get-caller-identity --query Account --output text
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to get account ID"
        }
    } catch {
        Write-Host "Error: Failed to get AWS account ID. Please check your AWS credentials." -ForegroundColor $Red
        exit 1
    }
}

Write-Host "Configuration:" -ForegroundColor $Yellow
Write-Host "Environment: $Environment"
Write-Host "Region: $Region"
Write-Host "Account: $Account"
Write-Host ""

# Bootstrap CDK
Write-Host "Bootstrapping CDK for account $Account in region $Region..." -ForegroundColor $Green
cdk bootstrap "aws://$Account/$Region"

if ($LASTEXITCODE -eq 0) {
    Write-Host "CDK bootstrap completed successfully!" -ForegroundColor $Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor $Yellow
    Write-Host "1. Run 'npm run cdk:synth' to synthesize the CloudFormation template"
    Write-Host "2. Run 'npm run cdk:deploy' to deploy the stack"
    Write-Host "3. Run 'npm run cdk:diff' to see changes before deployment"
} else {
    Write-Host "CDK bootstrap failed!" -ForegroundColor $Red
    exit 1
}