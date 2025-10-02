import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CicdPipeline } from '../constructs/cicd-pipeline';

export interface CicdStackProps extends cdk.StackProps {
  environment: string;
  repositoryName?: string;
  branchName?: string;
  githubOwner?: string;
  githubToken?: string;
}

/**
 * CI/CD Stack that creates the deployment pipeline infrastructure
 * This stack is separate from the application stack to allow independent management
 */
export class CicdStack extends cdk.Stack {
  public readonly pipeline: CicdPipeline;

  constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);

    const { environment, repositoryName, branchName, githubOwner, githubToken } = props;

    // Add stack-level tags
    cdk.Tags.of(this).add('Project', 'InsuranceQuotation');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Component', 'CICD');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // Create CI/CD pipeline
    const pipelineProps: any = { environment };
    if (repositoryName) pipelineProps.repositoryName = repositoryName;
    if (branchName) pipelineProps.branchName = branchName;
    if (githubOwner) pipelineProps.githubOwner = githubOwner;
    if (githubToken) pipelineProps.githubToken = githubToken;
    
    this.pipeline = new CicdPipeline(this, 'Pipeline', pipelineProps);

    // Configure GitHub integration if owner and repo are provided
    if (githubOwner && repositoryName) {
      this.pipeline.configureGitHubIntegration(githubOwner, repositoryName);
    }

    // Add outputs
    this.pipeline.addOutputs();

    // Output the environment for verification
    new cdk.CfnOutput(this, 'Environment', {
      value: environment,
      description: 'CI/CD environment',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
    });

    new cdk.CfnOutput(this, 'Account', {
      value: this.account,
      description: 'AWS Account ID',
    });
  }
}