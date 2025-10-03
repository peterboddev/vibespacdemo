import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface LambdaLayerProps {
  environment: string;
}

/**
 * Lambda Layer and shared infrastructure construct
 * 
 * This construct provides foundational components that applications depend on:
 * - Shared dependencies Lambda layer
 * - SNS topics for notifications
 * 
 * These are deployed as part of infrastructure (CLI) rather than application (pipeline)
 * because they are foundational services that applications need to exist before deployment.
 */
export class LambdaLayer extends Construct {
  public readonly sharedLayer: lambda.LayerVersion;
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: LambdaLayerProps) {
    super(scope, id);

    const { environment } = props;

    // Create Lambda layer for shared dependencies (pre-built, no Docker required)
    // The layer should be pre-built with: npm run layer:build
    this.sharedLayer = new lambda.LayerVersion(this, 'SharedDependenciesLayer', {
      layerVersionName: `insurance-quotation-shared-${environment}`,
      description: 'Shared dependencies for Insurance Quotation Lambda functions',
      code: lambda.Code.fromAsset('layers/shared-dependencies'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create SNS topic for health alerts and notifications
    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `insurance-quotation-alerts-${environment}`,
      displayName: `Insurance Quotation Alerts - ${environment}`,
    });

    // Add tags to all resources
    cdk.Tags.of(this).add('Project', 'InsuranceQuotation');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Component', 'LambdaLayer');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }

  /**
   * Add outputs for the Lambda layer infrastructure
   */
  public addOutputs(): void {
    new cdk.CfnOutput(this, 'SharedLayerArn', {
      value: this.sharedLayer.layerVersionArn,
      description: 'Shared dependencies layer ARN',
      exportName: `InsuranceQuotation-SharedLayerArn-${this.node.tryGetContext('environment') || 'dev'}`,
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'SNS topic ARN for alerts',
      exportName: `InsuranceQuotation-AlertTopicArn-${this.node.tryGetContext('environment') || 'dev'}`,
    });

    new cdk.CfnOutput(this, 'SharedLayerName', {
      value: `insurance-quotation-shared-${this.node.tryGetContext('environment') || 'dev'}`,
      description: 'Shared dependencies layer name',
    });
  }
}