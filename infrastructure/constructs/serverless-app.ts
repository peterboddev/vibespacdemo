import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface ServerlessAppProps {
  environment: string;
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  lambdaSubnets: ec2.SubnetSelection;
  databaseSecretArn: string;
  redisSecretArn: string;
  sharedLayerArn: string;
  alertTopicArn: string;
}

/**
 * Serverless application infrastructure construct that creates:
 * - API Gateway with stages and base configuration
 * - Lambda execution roles and policies
 * - CloudWatch log groups
 * - Lambda layers for shared dependencies
 * - Foundation for dynamic route generation via CodeBuild
 */
export class ServerlessApp extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly lambdaRole: iam.Role;
  public readonly sharedLayer: lambda.ILayerVersion;
  public readonly logGroup: logs.LogGroup;

  public readonly alertTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: ServerlessAppProps) {
    super(scope, id);

    const { environment, databaseSecretArn, redisSecretArn, sharedLayerArn, alertTopicArn } = props;

    // Import shared layer from infrastructure
    this.sharedLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ImportedSharedLayer', sharedLayerArn);

    // Import alert topic from infrastructure
    this.alertTopic = sns.Topic.fromTopicArn(this, 'ImportedAlertTopic', alertTopicArn);

    // Create CloudWatch log group for Lambda functions
    this.logGroup = new logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/insurance-quotation-${environment}`,
      retention: environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create Lambda execution role with comprehensive permissions
    this.lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: `Lambda execution role for Insurance Quotation ${environment}`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
      inlinePolicies: {
        DatabaseAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
                'secretsmanager:DescribeSecret',
              ],
              resources: [databaseSecretArn, redisSecretArn],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'rds:DescribeDBClusters',
                'rds:DescribeDBInstances',
              ],
              resources: ['*'], // RDS describe operations require wildcard
            }),
          ],
        }),
        CloudWatchLogs: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: [this.logGroup.logGroupArn + ':*'],
            }),
          ],
        }),
        VPCAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ec2:CreateNetworkInterface',
                'ec2:DescribeNetworkInterfaces',
                'ec2:DeleteNetworkInterface',
                'ec2:AttachNetworkInterface',
                'ec2:DetachNetworkInterface',
              ],
              resources: ['*'], // VPC operations require wildcard
            }),
          ],
        }),
      },
    });



    // Create API Gateway with comprehensive configuration
    this.api = new apigateway.RestApi(this, 'InsuranceQuotationApi', {
      restApiName: `insurance-quotation-${environment}`,
      description: `Insurance Quotation API - ${environment}`,
      
      // API Gateway configuration
      deployOptions: {
        stageName: environment,
        throttlingRateLimit: environment === 'prod' ? 1000 : 100,
        throttlingBurstLimit: environment === 'prod' ? 2000 : 200,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: environment !== 'prod',
        metricsEnabled: true,
      },

      // CORS configuration for web applications
      defaultCorsPreflightOptions: {
        allowOrigins: environment === 'prod' 
          ? ['https://insurance.example.com'] // Replace with actual domain
          : apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
        ],
        allowCredentials: true,
      },

      // API Gateway policy for security with environment-specific restrictions
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['*'],
            conditions: environment === 'prod' ? {
              IpAddress: {
                'aws:SourceIp': [
                  // Add allowed IP ranges for production
                  '0.0.0.0/0', // Replace with actual IP restrictions
                ],
              },
            } : {},
          }),
        ],
      }),

      // Enable binary media types for file uploads
      binaryMediaTypes: ['multipart/form-data', 'application/octet-stream'],
    });

    // Create base API structure for dynamic route generation
    const apiV1 = this.api.root.addResource('api').addResource('v1');
    
    // Add resource groups that will be populated dynamically
    apiV1.addResource('quotes');
    apiV1.addResource('users');
    apiV1.addResource('products');
    apiV1.addResource('health');



    // Note: Health check endpoint and monitoring will be deployed via pipeline
    // Infrastructure only provides the foundation (API Gateway shell, layer, SNS topic)

    // Create additional stages for different environments
    if (environment === 'dev') {
      // Create test stage for development
      new apigateway.Stage(this, 'TestStage', {
        deployment: this.api.latestDeployment!,
        stageName: 'test',
        throttlingRateLimit: 50,
        throttlingBurstLimit: 100,
      });
    }

    // Add tags to all resources
    cdk.Tags.of(this).add('Project', 'InsuranceQuotation');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Component', 'ServerlessApp');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }

  /**
   * Get the base configuration for Lambda functions
   */
  public getLambdaConfig(): {
    role: iam.Role;
    layers: lambda.ILayerVersion[];
    logGroup: logs.LogGroup;
    environment: { [key: string]: string };
  } {
    return {
      role: this.lambdaRole,
      layers: [this.sharedLayer],
      logGroup: this.logGroup,
      environment: {
        NODE_ENV: this.node.tryGetContext('environment') || 'dev',
        LOG_LEVEL: this.node.tryGetContext('environment') === 'prod' ? 'info' : 'debug',
      },
    };
  }

  /**
   * Get API Gateway resource by path for dynamic route generation
   */
  public getApiResource(path: string): apigateway.IResource {
    const pathParts = path.split('/').filter(part => part.length > 0);
    let resource: apigateway.IResource = this.api.root;
    
    for (const part of pathParts) {
      const existingResource = resource.node.tryFindChild(part);
      if (existingResource && existingResource instanceof apigateway.Resource) {
        resource = existingResource;
      } else {
        resource = resource.addResource(part);
      }
    }
    
    return resource;
  }



  /**
   * Add outputs for the serverless application
   */
  public addOutputs(): void {
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `InsuranceQuotation-ApiUrl-${this.node.tryGetContext('environment') || 'dev'}`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: `InsuranceQuotation-ApiId-${this.node.tryGetContext('environment') || 'dev'}`,
    });

    new cdk.CfnOutput(this, 'LambdaRoleArn', {
      value: this.lambdaRole.roleArn,
      description: 'Lambda execution role ARN',
      exportName: `InsuranceQuotation-LambdaRoleArn-${this.node.tryGetContext('environment') || 'dev'}`,
    });


  }
}