# CI/CD Pipeline Deployment Guide

This guide explains how to deploy and use the CI/CD pipeline for the Insurance Quotation API.

## ✅ Pipeline Status: DEPLOYED AND ACTIVE

The CI/CD pipeline has been successfully deployed and is operational:

- **Pipeline Name**: insurance-quotation-dev
- **Pipeline ARN**: arn:aws:codepipeline:us-east-1:450683699755:insurance-quotation-dev
- **Build Project**: insurance-quotation-dev
- **Artifact Bucket**: insurance-quotation-pipeline-dev-450683699755
- **Status**: Active and monitoring GitHub repository
- **Last Updated**: Infrastructure construct maintained and up-to-date

## Overview

The CI/CD pipeline provides:
- **Automated builds** with ✅ **TypeScript compilation re-enabled** for proper type checking
- **Dynamic route generation** from Lambda function annotations (optional, currently disabled)
- **Multi-environment deployment** (dev automatic, prod with manual approval)
- **CloudWatch monitoring** and SNS notifications
- **Artifact management** with S3 storage and lifecycle policies
- **CodePipeline integration** with CodeBuild projects
- **Comprehensive IAM roles** with least-privilege permissions
- **Build caching** for faster execution times
- **GitHub webhook integration** for automatic triggering

**Repository Configuration**:
- **Repository**: `peterboddev/vibespacdemo`
- **Branch**: `main`
- **Owner**: `peterboddev`
- **URL**: https://github.com/peterboddev/vibespacdemo

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Source    │───▶│    Build     │───▶│  Deploy Dev │───▶│ Approval +   │
│ (S3/GitHub) │    │ + Test +     │    │ (Automatic) │    │ Deploy Prod  │
│             │    │ Route Gen    │    │             │    │ (Manual)     │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

## Prerequisites ✅ COMPLETED

1. **AWS CLI** configured with appropriate permissions ✅
2. **CDK Bootstrap** completed for your account/region ✅
3. **Node.js 20+** and npm installed ✅
4. **Project dependencies** installed (`npm ci`) ✅
5. **Git credentials** configured for GitHub integration ✅

## Pipeline Usage (Already Deployed)

The pipeline is already deployed and active. Here's how to use it:

### 1. Automatic Triggering

The pipeline automatically triggers when you push changes to the main branch:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

### 2. Monitor Pipeline Execution

```bash
# Check the pipeline status
aws codepipeline get-pipeline-state --name insurance-quotation-dev

# List recent pipeline executions
aws codepipeline list-pipeline-executions --pipeline-name insurance-quotation-dev --max-items 5

# Manual pipeline trigger (if needed)
aws codepipeline start-pipeline-execution --name insurance-quotation-dev
```

### 3. View Build Logs

```bash
# View build logs
aws logs describe-log-groups --log-group-name-prefix /aws/codebuild/insurance-quotation-dev

# Tail build logs in real-time
aws logs tail /aws/codebuild/insurance-quotation-dev --follow
```

## Pipeline Configuration

### Infrastructure Components

The CI/CD pipeline creates:

- **CodePipeline**: Main orchestration pipeline with multiple stages
- **CodeBuild Projects**: Separate projects for build and deployment
- **S3 Artifact Bucket**: Versioned storage with lifecycle policies
- **CloudWatch Log Groups**: Centralized logging with retention policies
- **SNS Topic**: Notifications for pipeline events and failures
- **IAM Roles**: Least-privilege roles for build and deployment
- **CloudWatch Alarms**: Monitoring for pipeline and build failures

### Environment Variables

The pipeline uses these environment variables:

- `ENVIRONMENT`: Target environment (dev/prod)
- `TARGET_ENVIRONMENT`: Specific deployment target
- `STAGE`: Pipeline stage (build/deploy-dev/deploy-prod)
- `NODE_ENV`: Node.js environment (production)
- `AWS_DEFAULT_REGION`: AWS region for deployment
- `AWS_ACCOUNT_ID`: AWS account ID for resource naming

### Build Stages

1. **Install**: 
   - Enhanced dependency installation with npm ci primary method and npm install fallback
   - Package verification and debugging information
   - Global tool installation (CDK, TypeScript)
2. **Pre-build**: 
   - Generate dynamic routes from Lambda annotations (currently disabled)
   - Multi-tier TypeScript compilation with fallback strategies
   - Run tests and linting (currently disabled for deployment focus)
3. **Build**: 
   - CDK synthesis
   - Conditional deployment based on stage
4. **Post-build**: 
   - Health checks
   - Output collection

### Pipeline Stages

1. **Source**: S3-based source retrieval (GitHub integration available)
2. **Build**: TypeScript compilation, testing, and CDK synthesis
3. **DeployDev**: Automatic deployment to development environment
4. **ApprovalForProd**: Manual approval step (production pipeline only)
5. **DeployProd**: Deployment to production (production pipeline only)

### CodeBuild Projects

- **Build Project**: Main build with testing and synthesis
- **Deploy Projects**: Environment-specific deployment projects
- **Compute Type**: SMALL instances for cost optimization
- **Build Image**: Amazon Linux Standard 7.0 with Node.js 20
- **Privileged Mode**: **Enabled for Docker support** (required for Lambda layer bundling)
- **Build Specification**: Automatically reads buildspec.yml from source repository root
- **Cache**: Local NPM cache for faster builds
- **Timeout**: 30 minutes for build, 20 minutes for deployment

## Using the Pipeline

### GitHub Integration ✅ ACTIVE

The pipeline is fully integrated with GitHub and automatically triggers on code changes:

**Current Repository Configuration**:
- **Repository**: `peterboddev/vibespacdemo`
- **Branch**: `main`
- **Owner**: `peterboddev`
- **URL**: https://github.com/peterboddev/vibespacdemo
- **Webhook**: Active and configured
- **GitHub Token**: Stored securely in AWS Secrets Manager

**How it works**:
1. Push changes to the main branch
2. GitHub webhook triggers the pipeline automatically
3. Pipeline pulls the latest code and starts the build process
4. Automatic deployment to development environment on successful build

### Monitoring Pipeline Execution

```bash
# Watch pipeline execution
aws codepipeline get-pipeline-execution \
  --pipeline-name insurance-quotation-dev \
  --pipeline-execution-id {execution-id}

# View build logs
aws logs tail /aws/codebuild/insurance-quotation-dev --follow
```

## Dynamic Route Generation

The pipeline includes optional dynamic route generation:

1. **Scans** Lambda functions for route annotations (when enabled)
2. **Generates** `infrastructure/generated/routes.json` if successful
3. **Falls back** to default configuration if generation fails
4. **Integrates** routes into CDK deployment
5. **Deploys** API Gateway with generated or default routes

**Current Status**: Route generation is currently disabled in the build process to ensure deployment reliability. The system uses default route configuration and can be re-enabled when needed.

### Route Annotation Example

```typescript
/**
 * @route POST /api/v1/quotes
 * @auth required
 * @rateLimit 100/hour
 * @timeout 30
 * @memory 512
 */
export const createQuote = async (event: APIGatewayProxyEvent) => {
  // Implementation
};
```

## Monitoring and Notifications

### CloudWatch Alarms

The pipeline includes automated monitoring:

- **Pipeline Failure Alarm**: Triggers on any pipeline execution failure
- **Build Failure Alarm**: Triggers on CodeBuild project failures
- **Automatic SNS Actions**: Sends notifications to the pipeline topic

### SNS Notifications

The pipeline sends notifications via SNS for:
- **Pipeline failures** with execution details
- **Build failures** with build logs reference
- **Manual approval requests** (production only)
- **Deployment completions** with stack outputs

Subscribe to notifications:

```bash
# Subscribe email to notifications
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:{ACCOUNT_ID}:insurance-quotation-pipeline-dev \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## Troubleshooting

### Common Issues

1. **Build Failures**:
   ```bash
   # Check build logs
   aws logs tail /aws/codebuild/insurance-quotation-dev --follow
   ```

2. **Permission Issues**:
   ```bash
   # Verify CodeBuild role permissions
   aws iam get-role --role-name InsuranceQuotation-CICD-dev-*
   ```

3. **CDK Bootstrap Issues**:
   ```bash
   # Re-bootstrap if needed
   cdk bootstrap --context environment=dev
   ```

### Pipeline Debugging

```bash
# Get pipeline details
aws codepipeline get-pipeline --name insurance-quotation-dev

# List failed executions
aws codepipeline list-pipeline-executions \
  --pipeline-name insurance-quotation-dev \
  --max-items 10
```

## Security Considerations

1. **IAM Roles**: 
   - Separate roles for build and deployment with least-privilege access
   - CodeBuild role has specific permissions for AWS services
   - Deploy roles have full permissions for their target environment
2. **Artifact Encryption**: S3 artifacts encrypted with AWS managed keys
3. **VPC Deployment**: Lambda functions deployed in private VPC subnets
4. **Secret Management**: 
   - Database credentials in AWS Secrets Manager
   - GitHub tokens in Systems Manager Parameter Store
5. **Manual Approval**: Production deployments require explicit approval
6. **Build Isolation**: Each build runs in isolated CodeBuild environment
7. **Access Logging**: All pipeline activities logged to CloudWatch

## Cost Optimization

1. **Artifact Lifecycle**: 
   - Old artifacts deleted after 30 days
   - Non-current versions deleted after 7 days
   - Versioned S3 bucket with intelligent tiering
2. **Build Caching**: 
   - Local NPM cache for faster builds
   - Cached node_modules between builds
   - Reduced build times and compute costs
3. **Compute Optimization**: 
   - CodeBuild SMALL instances (3 GB memory, 2 vCPUs)
   - **Privileged mode enabled for Docker support** (required for Lambda layer bundling)
   - Optimized build timeouts (30 min build, 20 min deploy)
4. **Log Retention**: 
   - Development: 1 week retention
   - Production: 1 month retention
   - Automatic log cleanup

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Keep CDK and build tools updated
2. **Review Logs**: Monitor build and deployment logs
3. **Clean Artifacts**: Verify S3 lifecycle policies are working
4. **Test Pipeline**: Regularly test the full pipeline flow

### Pipeline Updates

To update the pipeline itself:

```bash
# Make changes to pipeline code
# Then redeploy
npm run cicd:deploy
```

## Next Steps

After the pipeline is deployed:

1. **Test** the pipeline with a sample deployment
2. **Configure** GitHub integration (optional)
3. **Set up** SNS notifications
4. **Create** monitoring dashboards
5. **Document** team processes for using the pipeline

## Quick Access Links

### AWS Console Links
- [Pipeline Console](https://console.aws.amazon.com/codesuite/codepipeline/pipelines/insurance-quotation-dev/view)
- [CodeBuild Console](https://console.aws.amazon.com/codesuite/codebuild/projects)
- [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups)
- [S3 Artifacts](https://s3.console.aws.amazon.com/s3/buckets/insurance-quotation-pipeline-dev-450683699755)

### Useful Commands
```bash
# Check pipeline status
aws codepipeline get-pipeline-state --name insurance-quotation-dev

# View build logs
aws logs describe-log-groups --log-group-name-prefix /aws/codebuild/insurance-quotation-dev

# Manual pipeline trigger
aws codepipeline start-pipeline-execution --name insurance-quotation-dev
```

## Support

For issues with the CI/CD pipeline:

1. Check CloudWatch logs for build/deployment issues
2. Review IAM permissions for access issues
3. Verify CDK bootstrap status for deployment issues
4. Check SNS topic subscriptions for notification issues