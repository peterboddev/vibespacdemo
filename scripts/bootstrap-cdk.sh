#!/bin/bash

# CDK Bootstrap Script for Insurance Quotation Application
# This script helps set up CDK for different environments

set -e

# Default values
ENVIRONMENT=${ENVIRONMENT:-dev}
REGION=${AWS_DEFAULT_REGION:-us-east-1}
ACCOUNT=${CDK_DEFAULT_ACCOUNT}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Insurance Quotation CDK Bootstrap Script${NC}"
echo "=========================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo -e "${RED}Error: AWS CDK is not installed. Installing it now...${NC}"
    npm install -g aws-cdk
fi

# Get AWS account ID if not provided
if [ -z "$ACCOUNT" ]; then
    echo "Getting AWS account ID..."
    ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to get AWS account ID. Please check your AWS credentials.${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}Configuration:${NC}"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Account: $ACCOUNT"
echo ""

# Bootstrap CDK
echo -e "${GREEN}Bootstrapping CDK for account $ACCOUNT in region $REGION...${NC}"
cdk bootstrap aws://$ACCOUNT/$REGION

if [ $? -eq 0 ]; then
    echo -e "${GREEN}CDK bootstrap completed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Run 'npm run cdk:synth' to synthesize the CloudFormation template"
    echo "2. Run 'npm run cdk:deploy' to deploy the stack"
    echo "3. Run 'npm run cdk:diff' to see changes before deployment"
else
    echo -e "${RED}CDK bootstrap failed!${NC}"
    exit 1
fi