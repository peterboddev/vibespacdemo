#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InsuranceQuotationStack } from './stacks/insurance-quotation-stack';
import { getEnvironmentConfig } from './config/environments';

const app = new cdk.App();

// Get environment from context or environment variable
const environment = app.node.tryGetContext('environment') || process.env['ENVIRONMENT'] || 'dev';

// Get environment-specific configuration
const envConfig = getEnvironmentConfig(environment);

// Create the main stack
new InsuranceQuotationStack(app, `InsuranceQuotation-${environment}`, {
  env: envConfig.account ? {
    account: envConfig.account,
    region: envConfig.region,
  } : {
    region: envConfig.region,
  },
  environment: envConfig.environment,
  description: `Insurance Quotation API - ${environment} environment`,
  tags: {
    ...envConfig.tags,
    ManagedBy: 'CDK',
  },
});