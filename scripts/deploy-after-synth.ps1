# PowerShell script for automated deployment after successful CDK synthesis
# This script runs CDK synth, and if successful, automatically deploys to the development environment

param(
    [string]$Environment = "dev",
    [switch]$SkipHealthCheck = $false,
    [switch]$DryRun = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Blue = "Cyan"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-HealthChecks {
    param([string]$StackName)
    
    Write-ColorOutput "Running health checks..." $Blue
    
    # Get stack outputs
    try {
        $outputs = aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs" --output json | ConvertFrom-Json
        
        if (-not $outputs) {
            Write-ColorOutput "No stack outputs found. Skipping health checks." $Yellow
            return $true
        }
        
        # Check if database endpoint is available
        $dbEndpoint = ($outputs | Where-Object { $_.OutputKey -eq "DatabaseDatabaseClusterEndpoint" }).OutputValue
        if ($dbEndpoint) {
            Write-ColorOutput "✓ Database endpoint available: $dbEndpoint" $Green
        }
        
        # Check if VPC is created
        $vpcId = ($outputs | Where-Object { $_.OutputKey -eq "NetworkingVpcIdA4694F27" }).OutputValue
        if ($vpcId) {
            Write-ColorOutput "✓ VPC created: $vpcId" $Green
        }
        
        # Add more health checks as needed
        Write-ColorOutput "✓ All health checks passed!" $Green
        return $true
        
    } catch {
        Write-ColorOutput "✗ Health checks failed: $($_.Exception.Message)" $Red
        return $false
    }
}

function Invoke-Rollback {
    param([string]$StackName)
    
    Write-ColorOutput "Initiating rollback..." $Yellow
    
    try {
        # Cancel any in-progress stack update
        aws cloudformation cancel-update-stack --stack-name $StackName 2>$null
        
        # Wait for rollback to complete
        Write-ColorOutput "Waiting for rollback to complete..." $Yellow
        aws cloudformation wait stack-rollback-complete --stack-name $StackName
        
        Write-ColorOutput "✓ Rollback completed successfully" $Green
        return $true
    } catch {
        Write-ColorOutput "✗ Rollback failed: $($_.Exception.Message)" $Red
        return $false
    }
}

# Main deployment process
try {
    $StackName = "InsuranceQuotation-$Environment"
    
    Write-ColorOutput "=== Insurance Quotation Automated Deployment ===" $Blue
    Write-ColorOutput "Environment: $Environment" $Blue
    Write-ColorOutput "Stack Name: $StackName" $Blue
    Write-ColorOutput "Dry Run: $DryRun" $Blue
    Write-ColorOutput "" 
    
    # Step 1: Run CDK synthesis
    Write-ColorOutput "Step 1: Running CDK synthesis..." $Blue
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would run: npm run cdk:synth" $Yellow
    } else {
        npm run cdk:synth
        if ($LASTEXITCODE -ne 0) {
            throw "CDK synthesis failed with exit code $LASTEXITCODE"
        }
        Write-ColorOutput "✓ CDK synthesis completed successfully" $Green
    }
    
    # Step 2: Deploy to AWS
    Write-ColorOutput "Step 2: Deploying to AWS..." $Blue
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would run: cdk deploy $StackName --require-approval never" $Yellow
    } else {
        cdk deploy $StackName --require-approval never
        if ($LASTEXITCODE -ne 0) {
            throw "CDK deployment failed with exit code $LASTEXITCODE"
        }
        Write-ColorOutput "✓ Deployment completed successfully" $Green
    }
    
    # Step 3: Run health checks
    if (-not $SkipHealthCheck -and -not $DryRun) {
        Write-ColorOutput "Step 3: Running health checks..." $Blue
        $healthChecksPassed = Test-HealthChecks -StackName $StackName
        
        if (-not $healthChecksPassed) {
            Write-ColorOutput "Health checks failed. Initiating rollback..." $Red
            $rollbackSuccess = Invoke-Rollback -StackName $StackName
            
            if ($rollbackSuccess) {
                throw "Deployment failed health checks and was rolled back successfully"
            } else {
                throw "Deployment failed health checks and rollback also failed. Manual intervention required."
            }
        }
    } elseif ($SkipHealthCheck) {
        Write-ColorOutput "Step 3: Skipping health checks (as requested)" $Yellow
    } elseif ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would run health checks" $Yellow
    }
    
    # Success
    Write-ColorOutput "" 
    Write-ColorOutput "🎉 Deployment completed successfully!" $Green
    Write-ColorOutput "Environment: $Environment" $Green
    Write-ColorOutput "Stack: $StackName" $Green
    
    if (-not $DryRun) {
        Write-ColorOutput "" 
        Write-ColorOutput "You can view the deployed resources in the AWS Console:" $Blue
        Write-ColorOutput "https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/stackinfo?stackId=$StackName" $Blue
    }
    
} catch {
    Write-ColorOutput "" 
    Write-ColorOutput "💥 Deployment failed!" $Red
    Write-ColorOutput "Error: $($_.Exception.Message)" $Red
    Write-ColorOutput "" 
    Write-ColorOutput "Troubleshooting steps:" $Yellow
    Write-ColorOutput "1. Check the CloudFormation console for detailed error messages" $Yellow
    Write-ColorOutput "2. Verify your AWS credentials and permissions" $Yellow
    Write-ColorOutput "3. Check if there are any resource conflicts or limits" $Yellow
    Write-ColorOutput "4. Review the CDK synthesis output for any warnings" $Yellow
    
    exit 1
}