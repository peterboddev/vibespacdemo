# Setup Git Credentials
# This script helps create and configure the .git-credentials file

Write-Host "🔐 Setting up Git Credentials" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Check if .git-credentials already exists
if (Test-Path ".git-credentials") {
    Write-Host "⚠️  .git-credentials file already exists" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -notmatch "^[Yy]$") {
        Write-Host "Aborted." -ForegroundColor Yellow
        exit 0
    }
}

# Copy template
if (-not (Test-Path ".git-credentials.template")) {
    Write-Host "❌ .git-credentials.template not found" -ForegroundColor Red
    exit 1
}

Copy-Item ".git-credentials.template" ".git-credentials"
Write-Host "✅ Created .git-credentials from template" -ForegroundColor Green

Write-Host ""
Write-Host "📝 Please edit .git-credentials with your actual values:" -ForegroundColor Yellow
Write-Host "   - GITHUB_TOKEN: Your GitHub Personal Access Token"
Write-Host "   - GITHUB_OWNER: peterboddev (your GitHub username)"
Write-Host "   - GITHUB_REPO: vibespacdemo (your repository name)"
Write-Host "   - GITHUB_BRANCH: main (your default branch)"
Write-Host "   - AWS_ACCOUNT_ID: Your AWS Account ID (if using CI/CD)"
Write-Host ""
Write-Host "💡 To use the credentials in your shell:" -ForegroundColor Cyan
Write-Host "   PowerShell: . .\.git-credentials"
Write-Host "   CMD:        call .git-credentials.bat (if converted)"
Write-Host ""
Write-Host "🔒 The .git-credentials file is in .gitignore and will not be committed" -ForegroundColor Green