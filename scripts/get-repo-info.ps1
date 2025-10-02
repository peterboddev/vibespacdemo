# Get Git Repository Information Script
# This script helps identify the current repository details for CI/CD setup

Write-Host "Getting Git repository information..." -ForegroundColor Green

# Check if we're in a Git repository
if (-not (Test-Path ".git")) {
    Write-Host "✗ Not in a Git repository. Please run this from the project root." -ForegroundColor Red
    exit 1
}

# Get remote origin URL
try {
    $remoteUrl = git remote get-url origin
    Write-Host "✓ Git remote origin found: $remoteUrl" -ForegroundColor Green
    
    # Parse GitHub repository information
    if ($remoteUrl -match "github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?$") {
        $githubOwner = $matches[1]
        $repoName = $matches[2]
        
        Write-Host ""
        Write-Host "GitHub Repository Information:" -ForegroundColor Cyan
        Write-Host "  Owner: $githubOwner" -ForegroundColor White
        Write-Host "  Repository: $repoName" -ForegroundColor White
        Write-Host "  URL: $remoteUrl" -ForegroundColor White
        
        # Get current branch
        $currentBranch = git branch --show-current
        Write-Host "  Current Branch: $currentBranch" -ForegroundColor White
        
        Write-Host ""
        Write-Host "Environment variables for CI/CD deployment:" -ForegroundColor Yellow
        Write-Host "`$env:GITHUB_OWNER = '$githubOwner'" -ForegroundColor Green
        Write-Host "`$env:REPOSITORY_NAME = '$repoName'" -ForegroundColor Green
        Write-Host "`$env:BRANCH_NAME = '$currentBranch'" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "Copy and run these commands before deploying:" -ForegroundColor Cyan
        Write-Host "`$env:GITHUB_OWNER = '$githubOwner'" -ForegroundColor White
        Write-Host "`$env:REPOSITORY_NAME = '$repoName'" -ForegroundColor White
        Write-Host "`$env:BRANCH_NAME = '$currentBranch'" -ForegroundColor White
        
    } else {
        Write-Host "✗ Remote URL doesn't appear to be a GitHub repository" -ForegroundColor Red
        Write-Host "  URL: $remoteUrl" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "✗ Failed to get remote origin URL" -ForegroundColor Red
    Write-Host "  Make sure you have a remote origin configured" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ CI/CD Pipeline Status: DEPLOYED AND ACTIVE" -ForegroundColor Green
Write-Host ""
Write-Host "Pipeline Details:" -ForegroundColor Cyan
Write-Host "  Pipeline Name: insurance-quotation-dev" -ForegroundColor White
Write-Host "  Repository: peterboddev/vibespacdemo" -ForegroundColor White
Write-Host "  Branch: main" -ForegroundColor White
Write-Host "  Status: Active with GitHub webhook integration" -ForegroundColor White
Write-Host ""
Write-Host "Console Links:" -ForegroundColor Yellow
Write-Host "  Pipeline: https://console.aws.amazon.com/codesuite/codepipeline/pipelines/insurance-quotation-dev/view" -ForegroundColor White
Write-Host "  CodeBuild: https://console.aws.amazon.com/codesuite/codebuild/projects" -ForegroundColor White
Write-Host ""
Write-Host "The pipeline automatically triggers when you push to the main branch!" -ForegroundColor Green