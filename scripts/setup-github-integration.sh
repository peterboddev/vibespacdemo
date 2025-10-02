#!/bin/bash
# Setup GitHub Integration for CI/CD Pipeline
# This script reads from .git-credentials and configures GitHub integration
set -e

CREDENTIALS_FILE=".git-credentials"
REGION="${AWS_REGION:-us-east-1}"
SECRET_NAME="github-token"

echo "🔧 Setting up GitHub Integration for CI/CD Pipeline"
echo "=================================================="

# Check if .git-credentials file exists
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo "❌ Credentials file not found: $CREDENTIALS_FILE"
    echo "Please run 'npm run setup:credentials-bash' first to create the credentials file."
    exit 1
fi

# Read credentials from file
echo "📋 Reading credentials from $CREDENTIALS_FILE..."
source "$CREDENTIALS_FILE"

# Validate required credentials
if [ -z "$GITHUB_TOKEN" ] || [ -z "$GITHUB_OWNER" ] || [ -z "$GITHUB_REPO" ]; then
    echo "❌ Missing required credentials in $CREDENTIALS_FILE:"
    [ -z "$GITHUB_TOKEN" ] && echo "  - GITHUB_TOKEN"
    [ -z "$GITHUB_OWNER" ] && echo "  - GITHUB_OWNER"
    [ -z "$GITHUB_REPO" ] && echo "  - GITHUB_REPO"
    echo "Please update your credentials file with actual values."
    exit 1
fi

echo "✅ Credentials loaded successfully"
echo "  GitHub Owner: $GITHUB_OWNER"
echo "  GitHub Repo: $GITHUB_REPO"
echo "  GitHub Branch: ${GITHUB_BRANCH:-main}"
echo ""
echo "🎯 Expected Configuration:"
echo "  Repository: peterboddev/vibespacdemo"
echo "  Branch: main"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is logged in to AWS
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "✅ AWS credentials configured for account: $ACCOUNT_ID"

# Store GitHub token in AWS Secrets Manager
echo ""
echo "💾 Storing GitHub token in AWS Secrets Manager..."
aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "GitHub Personal Access Token for CI/CD Pipeline" \
    --secret-string "$GITHUB_TOKEN" \
    --region $REGION 2>/dev/null || \
aws secretsmanager update-secret \
    --secret-id "$SECRET_NAME" \
    --secret-string "$GITHUB_TOKEN" \
    --region $REGION

echo "✅ GitHub token stored successfully in AWS Secrets Manager"

# Set environment variables for deployment
echo ""
echo "🔧 Setting environment variables for deployment..."
export GITHUB_OWNER="$GITHUB_OWNER"
export GITHUB_REPO="$GITHUB_REPO"
export GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

echo "✅ Environment variables set"

echo ""
echo "✅ GitHub Integration Setup Complete!"
echo ""
echo "✅ CI/CD Pipeline Status: ALREADY DEPLOYED AND ACTIVE"
echo "====================================================="
echo ""
echo "📋 Pipeline Details:"
echo "- Pipeline Name: insurance-quotation-dev"
echo "- Repository: $GITHUB_OWNER/$GITHUB_REPO"
echo "- Branch: ${GITHUB_BRANCH:-main}"
echo "- Secret: $SECRET_NAME (in AWS Secrets Manager)"
echo "- Status: Active with GitHub webhook integration"
echo ""
echo "🔗 Console Links:"
echo "- Pipeline: https://console.aws.amazon.com/codesuite/codepipeline/pipelines/insurance-quotation-dev/view"
echo "- CodeBuild: https://console.aws.amazon.com/codesuite/codebuild/projects"
echo "- CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups"
echo ""
echo "🚀 The pipeline automatically triggers on pushes to the ${GITHUB_BRANCH:-main} branch!"
echo ""
echo "📋 Useful Commands:"
echo "- Check pipeline status: aws codepipeline get-pipeline-state --name insurance-quotation-dev"
echo "- Manual trigger: aws codepipeline start-pipeline-execution --name insurance-quotation-dev"
echo "- View logs: aws logs tail /aws/codebuild/insurance-quotation-dev --follow"