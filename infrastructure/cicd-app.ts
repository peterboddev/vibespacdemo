#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CicdStack } from './stacks/cicd-stack';

/**
 * CI/CD Pipeline CDK App
 * 
 * This app creates the CI/CD pipeline infrastructure separately from the main application.
 * This allows the pipeline to deploy and manage the application infrastructure.
 */

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';

// Get AWS account and region
const account = process.env['CDK_DEFAULT_ACCOUNT'] || process.env['AWS_ACCOUNT_ID'];
const region = process.env['CDK_DEFAULT_REGION'] || process.env['AWS_REGION'] || 'us-east-1';

// Create CI/CD stack
const stackProps: any = {
  environment,
  repositoryName: process.env['GITHUB_REPO'] || 'vibespacdemo',
  branchName: process.env['GITHUB_BRANCH'] || 'main',
  description: `CI/CD Pipeline for Insurance Quotation API - ${environment}`,
  stackName: `InsuranceQuotation-CICD-${environment}`,
  terminationProtection: environment === 'prod',
};

// Add env if account is available
if (account) {
  stackProps.env = { account, region };
}

// Add GitHub integration with defaults
stackProps.githubOwner = process.env['GITHUB_OWNER'] || 'peterboddev';
if (process.env['GITHUB_TOKEN']) {
  stackProps.githubToken = process.env['GITHUB_TOKEN'];
}

const cicdStack = new CicdStack(app, `InsuranceQuotation-CICD-${environment}`, stackProps);

// Add additional tags
cdk.Tags.of(cicdStack).add('Application', 'InsuranceQuotationAPI');
cdk.Tags.of(cicdStack).add('Owner', 'DevOps');
cdk.Tags.of(cicdStack).add('CostCenter', 'Engineering');
cdk.Tags.of(cicdStack).add('Backup', environment === 'prod' ? 'Required' : 'Optional');