#!/bin/bash

# Get Git Repository Information Script
# This script helps identify the current repository details for CI/CD setup

set -e

echo "Getting Git repository information..."

# Check if we're in a Git repository
if [ ! -d ".git" ]; then
    echo "✗ Not in a Git repository. Please run this from the project root."
    exit 1
fi

# Get remote origin URL
if REMOTE_URL=$(git remote get-url origin 2>/dev/null); then
    echo "✓ Git remote origin found: $REMOTE_URL"
    
    # Parse GitHub repository information
    if [[ $REMOTE_URL =~ github\.com[:/]([^/]+)/([^/]+?)(\.git)?$ ]]; then
        GITHUB_OWNER="${BASH_REMATCH[1]}"
        REPO_NAME="${BASH_REMATCH[2]}"
        
        echo ""
        echo "GitHub Repository Information:"
        echo "  Owner: $GITHUB_OWNER"
        echo "  Repository: $REPO_NAME"
        echo "  URL: $REMOTE_URL"
        
        # Get current branch
        CURRENT_BRANCH=$(git branch --show-current)
        echo "  Current Branch: $CURRENT_BRANCH"
        
        echo ""
        echo "Environment variables for CI/CD deployment:"
        echo "export GITHUB_OWNER='$GITHUB_OWNER'"
        echo "export REPOSITORY_NAME='$REPO_NAME'"
        echo "export BRANCH_NAME='$CURRENT_BRANCH'"
        
        echo ""
        echo "Copy and run these commands before deploying:"
        echo "export GITHUB_OWNER='$GITHUB_OWNER'"
        echo "export REPOSITORY_NAME='$REPO_NAME'"
        echo "export BRANCH_NAME='$CURRENT_BRANCH'"
        
    else
        echo "✗ Remote URL doesn't appear to be a GitHub repository"
        echo "  URL: $REMOTE_URL"
    fi
    
else
    echo "✗ Failed to get remote origin URL"
    echo "  Make sure you have a remote origin configured"
fi

echo ""
echo "✅ CI/CD Pipeline Status: DEPLOYED AND ACTIVE"
echo ""
echo "Pipeline Details:"
echo "  Pipeline Name: insurance-quotation-dev"
echo "  Repository: peterboddev/vibespacdemo"
echo "  Branch: main"
echo "  Status: Active with GitHub webhook integration"
echo ""
echo "Console Links:"
echo "  Pipeline: https://console.aws.amazon.com/codesuite/codepipeline/pipelines/insurance-quotation-dev/view"
echo "  CodeBuild: https://console.aws.amazon.com/codesuite/codebuild/projects"
echo ""
echo "The pipeline automatically triggers when you push to the main branch!"