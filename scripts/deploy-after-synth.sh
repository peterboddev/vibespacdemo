#!/bin/bash
# Bash script for automated deployment after successful CDK synthesis
# This script runs CDK synth, and if successful, automatically deploys to the development environment

set -e  # Exit on any error

# Default values
ENVIRONMENT="dev"
SKIP_HEALTH_CHECK=false
DRY_RUN=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-health-check)
            SKIP_HEALTH_CHECK=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --environment ENV    Target environment (default: dev)"
            echo "  --skip-health-check      Skip health checks after deployment"
            echo "  --dry-run               Show what would be done without executing"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

function log_info() {
    echo -e "${BLUE}$1${NC}"
}

function log_success() {
    echo -e "${GREEN}$1${NC}"
}

function log_warning() {
    echo -e "${YELLOW}$1${NC}"
}

function log_error() {
    echo -e "${RED}$1${NC}"
}

function test_health_checks() {
    local stack_name=$1
    
    log_info "Running health checks..."
    
    # Get stack outputs
    if ! outputs=$(aws cloudformation describe-stacks --stack-name "$stack_name" --query "Stacks[0].Outputs" --output json 2>/dev/null); then
        log_warning "Could not retrieve stack outputs. Skipping health checks."
        return 0
    fi
    
    if [[ "$outputs" == "null" || "$outputs" == "[]" ]]; then
        log_warning "No stack outputs found. Skipping health checks."
        return 0
    fi
    
    # Check if database endpoint is available
    if db_endpoint=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="DatabaseDatabaseClusterEndpoint") | .OutputValue' 2>/dev/null); then
        if [[ "$db_endpoint" != "null" && -n "$db_endpoint" ]]; then
            log_success "✓ Database endpoint available: $db_endpoint"
        fi
    fi
    
    # Check if VPC is created
    if vpc_id=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="NetworkingVpcIdA4694F27") | .OutputValue' 2>/dev/null); then
        if [[ "$vpc_id" != "null" && -n "$vpc_id" ]]; then
            log_success "✓ VPC created: $vpc_id"
        fi
    fi
    
    log_success "✓ All health checks passed!"
    return 0
}

function invoke_rollback() {
    local stack_name=$1
    
    log_warning "Initiating rollback..."
    
    # Cancel any in-progress stack update
    aws cloudformation cancel-update-stack --stack-name "$stack_name" 2>/dev/null || true
    
    # Wait for rollback to complete
    log_warning "Waiting for rollback to complete..."
    if aws cloudformation wait stack-rollback-complete --stack-name "$stack_name"; then
        log_success "✓ Rollback completed successfully"
        return 0
    else
        log_error "✗ Rollback failed"
        return 1
    fi
}

# Main deployment process
STACK_NAME="InsuranceQuotation-$ENVIRONMENT"

log_info "=== Insurance Quotation Automated Deployment ==="
log_info "Environment: $ENVIRONMENT"
log_info "Stack Name: $STACK_NAME"
log_info "Dry Run: $DRY_RUN"
echo

# Step 1: Run CDK synthesis
log_info "Step 1: Running CDK synthesis..."
if [[ "$DRY_RUN" == "true" ]]; then
    log_warning "[DRY RUN] Would run: npm run cdk:synth"
else
    if npm run cdk:synth; then
        log_success "✓ CDK synthesis completed successfully"
    else
        log_error "CDK synthesis failed"
        exit 1
    fi
fi

# Step 2: Deploy to AWS
log_info "Step 2: Deploying to AWS..."
if [[ "$DRY_RUN" == "true" ]]; then
    log_warning "[DRY RUN] Would run: cdk deploy $STACK_NAME --require-approval never"
else
    if cdk deploy "$STACK_NAME" --require-approval never; then
        log_success "✓ Deployment completed successfully"
    else
        log_error "CDK deployment failed"
        exit 1
    fi
fi

# Step 3: Run health checks
if [[ "$SKIP_HEALTH_CHECK" == "false" && "$DRY_RUN" == "false" ]]; then
    log_info "Step 3: Running health checks..."
    if ! test_health_checks "$STACK_NAME"; then
        log_error "Health checks failed. Initiating rollback..."
        if invoke_rollback "$STACK_NAME"; then
            log_error "Deployment failed health checks and was rolled back successfully"
            exit 1
        else
            log_error "Deployment failed health checks and rollback also failed. Manual intervention required."
            exit 1
        fi
    fi
elif [[ "$SKIP_HEALTH_CHECK" == "true" ]]; then
    log_warning "Step 3: Skipping health checks (as requested)"
elif [[ "$DRY_RUN" == "true" ]]; then
    log_warning "[DRY RUN] Would run health checks"
fi

# Success
echo
log_success "🎉 Deployment completed successfully!"
log_success "Environment: $ENVIRONMENT"
log_success "Stack: $STACK_NAME"

if [[ "$DRY_RUN" == "false" ]]; then
    echo
    log_info "You can view the deployed resources in the AWS Console:"
    log_info "https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/stackinfo?stackId=$STACK_NAME"
fi