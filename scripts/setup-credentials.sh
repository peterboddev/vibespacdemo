#!/bin/bash
# Setup Git Credentials
# This script helps create and configure the .git-credentials file

set -e

echo "🔐 Setting up Git Credentials"
echo "============================="

# Check if .git-credentials already exists
if [ -f ".git-credentials" ]; then
    echo "⚠️  .git-credentials file already exists"
    read -p "Do you want to overwrite it? (y/N): " overwrite
    if [[ ! $overwrite =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Copy template
if [ ! -f ".git-credentials.template" ]; then
    echo "❌ .git-credentials.template not found"
    exit 1
fi

cp .git-credentials.template .git-credentials
echo "✅ Created .git-credentials from template"

echo ""
echo "📝 Please edit .git-credentials with your actual values:"
echo "   - GITHUB_TOKEN: Your GitHub Personal Access Token"
echo "   - GITHUB_OWNER: peterboddev (your GitHub username)"
echo "   - GITHUB_REPO: vibespacdemo (your repository name)"
echo "   - GITHUB_BRANCH: main (your default branch)"
echo "   - AWS_ACCOUNT_ID: Your AWS Account ID (if using CI/CD)"
echo ""
echo "💡 To use the credentials in your shell:"
echo "   Linux/Mac: source .git-credentials"
echo "   Windows:   . .\.git-credentials"
echo ""
echo "🔒 The .git-credentials file is in .gitignore and will not be committed"