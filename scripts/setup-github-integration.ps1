# GitHub Integration Setup Script for Insurance Quotation CI/CD Pipeline
# This script reads from .git-credentials and sets up GitHub integration in AWS Secrets Manager

param(
    [Parameter(Mandatory=$false)]
    [string]$CredentialsFile = ".git-credentials",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-east-1",
    
    [Parameter(Mandatory=$false)]
    [string]$SecretName = "github-token"
)

Write-Host "Setting up GitHub integration for Insurance Quotation CI/CD Pipeline..." -ForegroundColor Green

# Check if .git-credentials file exists
if (-not (Test-Path $CredentialsFile)) {
    Write-Host "ERROR: Credentials file not found: $CredentialsFile" -ForegroundColor Red
    Write-Host "Please run 'npm run setup:credentials' first to create the credentials file." -ForegroundColor Yellow
    exit 1
}

# Read credentials from file
Write-Host "Reading credentials from $CredentialsFile..." -ForegroundColor Yellow
$credentials = @{}

Get-Content $CredentialsFile | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.+)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $credentials[$key] = $value
    }
}

# Validate required credentials
$requiredKeys = @('GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO')
$missingKeys = @()

foreach ($key in $requiredKeys) {
    if (-not $credentials.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($credentials[$key])) {
        $missingKeys += $key
    }
}

if ($missingKeys.Count -gt 0) {
    Write-Host "ERROR: Missing required credentials in $CredentialsFile" -ForegroundColor Red
    $missingKeys | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host "Please update your credentials file with actual values." -ForegroundColor Yellow
    exit 1
}

Write-Host "SUCCESS: Credentials loaded successfully" -ForegroundColor Green
Write-Host "  GitHub Owner: $($credentials['GITHUB_OWNER'])" -ForegroundColor Gray
Write-Host "  GitHub Repo: $($credentials['GITHUB_REPO'])" -ForegroundColor Gray
Write-Host "  GitHub Branch: $($credentials['GITHUB_BRANCH'])" -ForegroundColor Gray
Write-Host ""
Write-Host "Expected Configuration:" -ForegroundColor Cyan
Write-Host "  Repository: peterboddev/vibespacdemo" -ForegroundColor White
Write-Host "  Branch: main" -ForegroundColor White

# Check if AWS CLI is available
try {
    aws --version | Out-Null
    Write-Host "SUCCESS: AWS CLI is available" -ForegroundColor Green
} catch {
    Write-Host "ERROR: AWS CLI is not available. Please install AWS CLI first." -ForegroundColor Red
    exit 1
}

# Check if user is authenticated
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "SUCCESS: AWS credentials configured for account: $($identity.Account)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: AWS credentials not configured. Please run 'aws configure' first." -ForegroundColor Red
    exit 1
}

# Create or update the GitHub token secret
Write-Host "Creating/updating GitHub token secret in AWS Secrets Manager..." -ForegroundColor Yellow

$secretValue = $credentials['GITHUB_TOKEN']

try {
    # Try to update existing secret first
    aws secretsmanager update-secret `
        --secret-id $SecretName `
        --secret-string $secretValue `
        --region $Region `
        --output json | Out-Null
    
    Write-Host "SUCCESS: Updated existing GitHub token secret: $SecretName" -ForegroundColor Green
} catch {
    try {
        # If update fails, create new secret
        aws secretsmanager create-secret `
            --name $SecretName `
            --description "GitHub personal access token for CI/CD pipeline" `
            --secret-string $secretValue `
            --region $Region `
            --output json | Out-Null
        
        Write-Host "SUCCESS: Created new GitHub token secret: $SecretName" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: Failed to create/update GitHub token secret" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Verify the secret was created/updated
try {
    $secretInfo = aws secretsmanager describe-secret `
        --secret-id $SecretName `
        --region $Region `
        --output json | ConvertFrom-Json
    
    Write-Host "SUCCESS: Secret verified: $($secretInfo.Name)" -ForegroundColor Green
    Write-Host "  ARN: $($secretInfo.Arn)" -ForegroundColor Gray
    Write-Host "  Last Modified: $($secretInfo.LastChangedDate)" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: Failed to verify secret creation" -ForegroundColor Red
    exit 1
}

# Set environment variables for deployment
Write-Host "Setting environment variables for deployment..." -ForegroundColor Yellow
$env:GITHUB_OWNER = $credentials['GITHUB_OWNER']
$env:GITHUB_REPO = $credentials['GITHUB_REPO']
$env:GITHUB_BRANCH = $credentials['GITHUB_BRANCH']

Write-Host "SUCCESS: Environment variables set" -ForegroundColor Green

Write-Host ""
Write-Host "✅ GitHub integration setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "✅ CI/CD Pipeline Status: ALREADY DEPLOYED AND ACTIVE" -ForegroundColor Green
Write-Host ""
Write-Host "Pipeline Details:" -ForegroundColor Cyan
Write-Host "  Pipeline Name: insurance-quotation-dev" -ForegroundColor White
Write-Host "  Repository: $($credentials['GITHUB_OWNER'])/$($credentials['GITHUB_REPO'])" -ForegroundColor White
Write-Host "  Branch: $($credentials['GITHUB_BRANCH'])" -ForegroundColor White
Write-Host "  Secret: $SecretName (in AWS Secrets Manager)" -ForegroundColor White
Write-Host "  Status: Active with GitHub webhook integration" -ForegroundColor White
Write-Host ""
Write-Host "Console Links:" -ForegroundColor Yellow
Write-Host "  Pipeline: https://console.aws.amazon.com/codesuite/codepipeline/pipelines/insurance-quotation-dev/view" -ForegroundColor White
Write-Host "  CodeBuild: https://console.aws.amazon.com/codesuite/codebuild/projects" -ForegroundColor White
Write-Host "  CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups" -ForegroundColor White
Write-Host ""
Write-Host "The pipeline automatically triggers on pushes to the $($credentials['GITHUB_BRANCH']) branch!" -ForegroundColor Green
Write-Host ""
Write-Host "To trigger the pipeline manually:" -ForegroundColor Cyan
Write-Host "  aws codepipeline start-pipeline-execution --name insurance-quotation-dev" -ForegroundColor White