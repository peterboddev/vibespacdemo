import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
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
  public readonly healthCheckFunction: lambda.Function;
  public readonly alertTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: ServerlessAppProps) {
    super(scope, id);

    const { environment, vpc, lambdaSecurityGroup, lambdaSubnets, databaseSecretArn, redisSecretArn, sharedLayerArn, alertTopicArn } = props;

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
    const healthResource = apiV1.addResource('health');



    // Create a basic health check endpoint (static, not dynamic)
    this.healthCheckFunction = new lambda.Function(this, 'HealthCheckFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('src/lambda/health'),
      role: this.lambdaRole,
      layers: [this.sharedLayer],
      
      // VPC configuration
      vpc,
      vpcSubnets: lambdaSubnets,
      securityGroups: [lambdaSecurityGroup],
      
      // Environment variables
      environment: {
        NODE_ENV: environment,
        LOG_LEVEL: environment === 'prod' ? 'info' : 'debug',
        REDIS_SECRET_ARN: redisSecretArn,
        DB_SECRET_ARN: databaseSecretArn,
      },
      
      // Performance configuration
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      
      // Logging configuration
      logGroup: this.logGroup,
    });

    // Add health check endpoint
    healthResource.addMethod('GET', new apigateway.LambdaIntegration(this.healthCheckFunction, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    }), {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // Create CloudWatch alarms for health monitoring
    this.createHealthMonitoringAlarms(environment);

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
   * Create CloudWatch alarms for health monitoring
   */
  private createHealthMonitoringAlarms(environment: string): void {
    // Health check function error rate alarm
    const healthCheckErrorAlarm = new cloudwatch.Alarm(this, 'HealthCheckErrorAlarm', {
      alarmName: `insurance-quotation-health-check-errors-${environment}`,
      alarmDescription: 'Health check function error rate is too high',
      metric: this.healthCheckFunction.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 3, // Alert if 3 or more errors in 5 minutes
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Health check function duration alarm
    const healthCheckDurationAlarm = new cloudwatch.Alarm(this, 'HealthCheckDurationAlarm', {
      alarmName: `insurance-quotation-health-check-duration-${environment}`,
      alarmDescription: 'Health check function duration is too high',
      metric: this.healthCheckFunction.metricDuration({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 10000, // Alert if average duration > 10 seconds
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // API Gateway 5xx error rate alarm
    const apiGateway5xxAlarm = new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      alarmName: `insurance-quotation-api-5xx-errors-${environment}`,
      alarmDescription: 'API Gateway 5xx error rate is too high',
      metric: this.api.metricServerError({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5, // Alert if 5 or more 5xx errors in 5 minutes
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // API Gateway high latency alarm
    const apiGatewayLatencyAlarm = new cloudwatch.Alarm(this, 'ApiGatewayLatencyAlarm', {
      alarmName: `insurance-quotation-api-latency-${environment}`,
      alarmDescription: 'API Gateway latency is too high',
      metric: this.api.metricLatency({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 5000, // Alert if average latency > 5 seconds
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Add SNS actions to all alarms
    const snsAction = new cloudwatchActions.SnsAction(this.alertTopic);
    
    healthCheckErrorAlarm.addAlarmAction(snsAction);
    healthCheckDurationAlarm.addAlarmAction(snsAction);
    apiGateway5xxAlarm.addAlarmAction(snsAction);
    apiGatewayLatencyAlarm.addAlarmAction(snsAction);

    // Add OK actions to send notifications when alarms recover
    healthCheckErrorAlarm.addOkAction(snsAction);
    healthCheckDurationAlarm.addOkAction(snsAction);
    apiGateway5xxAlarm.addOkAction(snsAction);
    apiGatewayLatencyAlarm.addOkAction(snsAction);
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