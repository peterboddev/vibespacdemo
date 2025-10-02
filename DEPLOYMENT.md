# Deployment Guide

This guide covers deploying the Insurance Quotation API to AWS using CDK.

## Prerequisites

1. **AWS Account**: You need an AWS account with appropriate permissions
2. **AWS CLI**: Install and configure AWS CLI with your credentials
3. **Node.js**: Version 18.0.0 or higher
4. **CDK CLI**: Install globally with `npm install -g aws-cdk`
5. **GitHub Token**: Personal Access Token for CI/CD integration (optional)

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Credentials

First, set up your Git credentials for CI/CD integration:

```bash
# Linux/Mac
npm run setup:credentials-bash

# Windows
npm run setup:credentials
```

This will create a `.git-credentials` file from the template. Edit it with your actual values:
- `GITHUB_TOKEN`: Your GitHub Personal Access Token
- `GITHUB_OWNER`: Your GitHub username/organization
- `AWS_ACCOUNT_ID`: Your AWS Account ID

Then configure your AWS CLI:

```bash
aws configure
# or
aws configure sso
```

Verify your credentials:

```bash
aws sts get-caller-identity
```

### 3. Bootstrap CDK

Bootstrap CDK in your AWS account (one-time setup):

```bash
npm run cdk:bootstrap
```

This will:
- Create necessary CDK resources in your AWS account
- Set up deployment permissions
- Configure the CDK toolkit stack

## Deployment Process

### 1. Review Changes

Before deploying, review what will be created:

```bash
npm run cdk:synth
```

Check differences from current deployment:

```bash
npm run cdk:diff
```

### 2. Deploy to Development

Deploy to the development environment:

```bash
npm run cdk:deploy
```

Or use the automated deployment workflow (recommended for development):

```bash
npm run cdk:synth-and-deploy
```

This command will synthesize and automatically deploy if synthesis succeeds, eliminating the need for separate commands.

### 3. Deploy to Other Environments

Deploy to test environment:

```bash
cdk deploy --context environment=test
```

Deploy to production:

```bash
cdk deploy --context environment=prod
```

## Deployed Infrastructure

The CDK deployment creates the following AWS resources:

### Core Infrastructure
- **VPC**: Multi-AZ VPC with public, private, and isolated subnets
- **Security Groups**: Separate security groups for Lambda, database, and cache
- **NAT Gateway**: Single NAT Gateway for cost-optimized outbound connectivity
- **VPC Endpoints**: S3, Secrets Manager, and CloudWatch endpoints

### Database Layer
- **Aurora Serverless v2 PostgreSQL**: Auto-scaling database cluster (0.5-16 ACUs)
- **Database Subnet Group**: Isolated subnets across multiple AZs
- **Automated Backups**: 7-day retention with point-in-time recovery
- **Secrets Manager**: Secure database credential storage

### Cache Layer
- **ElastiCache Serverless Redis**: Auto-scaling cache with performance optimization
- **Cache Subnet Group**: Isolated subnets for Redis deployment
- **Data Encryption**: Encryption in transit and at rest
- **Snapshot Configuration**: Daily snapshots for data persistence

### Compute Layer
- **API Gateway**: RESTful API endpoints with comprehensive CORS and security configuration
- **Lambda Functions**: Serverless compute for API handlers with VPC integration
- **Lambda Layers**: Shared dependencies with Docker bundling for production optimization
- **CloudWatch Logs**: Centralized logging with environment-specific retention policies
- **Health Check Endpoint**: Built-in health monitoring at `/api/v1/health`

## Environment Configuration

### Development Environment

- **Purpose**: Local development and testing
- **Region**: us-east-1 (default)
- **Resources**: Minimal configuration for cost optimization (50GB Redis, 5000 ECPU)
- **Data**: Test data only

### Test Environment

- **Purpose**: Integration testing and staging
- **Region**: us-east-1 (default)
- **Resources**: Production-like configuration
- **Data**: Staging data for testing

### Production Environment

- **Purpose**: Live production system
- **Region**: us-east-1 (default)
- **Resources**: Full production configuration (100GB Redis, 15000 ECPU, reader instance)
- **Data**: Live customer data
- **High Availability**: Multi-AZ deployment with reader instances

## Customization

### Override Default Settings

Use environment variables to customize deployment:

```bash
# Deploy to specific region
CDK_DEFAULT_REGION=us-west-2 npm run cdk:deploy

# Deploy to specific account
CDK_DEFAULT_ACCOUNT=123456789012 npm run cdk:deploy

# Deploy specific environment
ENVIRONMENT=prod npm run cdk:deploy
```

### Environment-Specific Configuration

Edit `infrastructure/config/environments.ts` to customize:

- AWS regions
- Resource tags
- Environment-specific settings
- Account-specific configurations

## Monitoring and Maintenance

### View Stack Status

```bash
# List all stacks
cdk list

# Show stack information
cdk metadata InsuranceQuotation-dev
```

### Update Stack

```bash
# Show what will change
npm run cdk:diff

# Deploy changes
npm run cdk:deploy
```

### Rollback

If you need to rollback changes:

```bash
# Destroy current stack (use with caution)
npm run cdk:destroy

# Redeploy previous version
git checkout <previous-commit>
npm run cdk:deploy
```

## Troubleshooting

### Common Issues

1. **Bootstrap Required**: If you get bootstrap errors, run `npm run cdk:bootstrap`

2. **Permission Denied**: Ensure your AWS credentials have sufficient permissions

3. **Region Mismatch**: Verify your AWS CLI region matches CDK configuration

4. **Account Mismatch**: Ensure you're deploying to the correct AWS account

### Getting Help

```bash
# CDK help
cdk --help

# Specific command help
cdk deploy --help

# Check CDK version
cdk --version
```

### Logs and Debugging

```bash
# Enable verbose logging
cdk deploy --verbose

# Debug mode
cdk deploy --debug
```

## Security Considerations

1. **IAM Permissions**: Use least privilege principle for deployment roles
2. **Secrets Management**: Store sensitive data in AWS Secrets Manager
3. **Network Security**: 
   - Database and Redis access restricted to VPC CIDR block only
   - Lambda functions deployed inside VPC with single NAT Gateway for cost optimization
   - Private subnets for Lambda, Aurora PostgreSQL, and ElastiCache Redis resources
   - VPC endpoints for AWS service communication
4. **Encryption**: Enable encryption at rest and in transit
5. **Monitoring**: Set up CloudWatch monitoring and alerting

## Cost Optimization

1. **Environment Sizing**: Use appropriate instance sizes for each environment
2. **Auto Scaling**: Configure auto-scaling for variable workloads
3. **Resource Cleanup**: Regularly clean up unused resources
4. **Reserved Instances**: Consider reserved instances for production
5. **Monitoring**: Use AWS Cost Explorer to track spending

## CI/CD Pipeline ✅ DEPLOYED AND ACTIVE

The CI/CD pipeline is already deployed and operational:

### Pipeline Status
- **Pipeline Name**: insurance-quotation-dev
- **Pipeline ARN**: arn:aws:codepipeline:us-east-1:450683699755:insurance-quotation-dev
- **Build Project**: insurance-quotation-dev
- **Artifact Bucket**: insurance-quotation-pipeline-dev-450683699755
- **GitHub Integration**: Active with webhook
- **Automatic Triggering**: Enabled on push to main branch

### Pipeline Features ✅ ACTIVE
- **Automated builds** with TypeScript compilation and testing
- **Dynamic route generation** from Lambda function annotations
- **Multi-environment deployment** (dev automatic, prod with manual approval)
- **CloudWatch monitoring** and SNS notifications
- **Artifact management** with S3 storage and lifecycle policies
- **GitHub webhook integration** for automatic triggering

### Using the Pipeline

The pipeline automatically triggers when you push changes to the main branch:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Monitor pipeline execution:
```bash
# Check pipeline status
aws codepipeline get-pipeline-state --name insurance-quotation-dev

# View recent executions
aws codepipeline list-pipeline-executions --pipeline-name insurance-quotation-dev --max-items 5
```

### Console Access
- [Pipeline Console](https://console.aws.amazon.com/codesuite/codepipeline/pipelines/insurance-quotation-dev/view)
- [CodeBuild Console](https://console.aws.amazon.com/codesuite/codebuild/projects)
- [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups)

See [CICD_DEPLOYMENT.md](CICD_DEPLOYMENT.md) for detailed CI/CD pipeline documentation.

## Next Steps

After successful deployment:

1. Configure domain names and SSL certificates
2. Set up monitoring and alerting
3. Configure backup and disaster recovery
4. Set up CI/CD pipeline (see above)
5. Set up log aggregation and analysis