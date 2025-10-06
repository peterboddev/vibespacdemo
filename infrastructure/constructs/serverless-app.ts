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
 * - Foundation for dynamic route generation via RouteGenerator (import added, integration pending)
 * - Enhanced Lambda deployment capability with aws-lambda-nodejs support (import added, ready for NodejsFunction migration)
 */
export class ServerlessApp extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly lambdaRole: iam.Role;
  public readonly sharedLayer: lambda.ILayerVersion;
  public readonly logGroup: logs.LogGroup;
  public readonly alertTopic: sns.ITopic;
  public readonly lambdaFunctions: lambda.Function[] = [];

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
        CloudWatchMetrics: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudwatch:PutMetricData',
              ],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'cloudwatch:namespace': 'InsuranceQuotation/Database'
                }
              }
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

    // Create Lambda functions and API routes
    this.createLambdaFunctions(vpc, lambdaSecurityGroup, lambdaSubnets, environment, databaseSecretArn, redisSecretArn);

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
   * Create Lambda functions and API Gateway routes
   */
  private createLambdaFunctions(
    _vpc: ec2.IVpc,
    _lambdaSecurityGroup: ec2.ISecurityGroup,
    _lambdaSubnets: ec2.SubnetSelection,
    environment: string,
    _databaseSecretArn: string,
    _redisSecretArn: string
  ): void {
    // Create enhanced health check Lambda function with database and Redis tests
    const healthFunction = new lambda.Function(this, 'healthFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
        const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
        const { Client } = require('pg');
        const Redis = require('ioredis');

        let secretsClient, cloudWatchClient, redisClient;

        const getSecretsClient = () => {
          if (!secretsClient) {
            secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
          }
          return secretsClient;
        };

        const getCloudWatchClient = () => {
          if (!cloudWatchClient) {
            cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
          }
          return cloudWatchClient;
        };

        const publishMetric = async (metricName, value, unit = 'Count', dimensions = {}) => {
          try {
            const client = getCloudWatchClient();
            const command = new PutMetricDataCommand({
              Namespace: 'InsuranceQuotation/Database',
              MetricData: [{
                MetricName: metricName,
                Value: value,
                Unit: unit,
                Timestamp: new Date(),
                Dimensions: Object.entries(dimensions).map(([name, value]) => ({
                  Name: name,
                  Value: value
                }))
              }]
            });
            await client.send(command);
          } catch (error) {
            console.error('Failed to publish metric:', error);
          }
        };

        const getSecret = async (secretArn) => {
          try {
            const client = getSecretsClient();
            const command = new GetSecretValueCommand({ SecretId: secretArn });
            const response = await client.send(command);
            return JSON.parse(response.SecretString);
          } catch (error) {
            console.error('Failed to get secret:', error);
            throw error;
          }
        };

        const checkDatabase = async () => {
          const startTime = Date.now();
          const operationLatencies = {};
          
          try {
            // Get database credentials
            const dbSecret = await getSecret(process.env.DATABASE_SECRET_ARN);
            operationLatencies.connection = Date.now() - startTime;

            // Create database client
            const client = new Client({
              host: dbSecret.host,
              port: dbSecret.port || 5432,
              database: dbSecret.dbname || 'insurance_quotation',
              user: dbSecret.username,
              password: dbSecret.password,
              ssl: process.env.NODE_ENV === 'production'
            });

            // Connect and test
            await client.connect();
            
            // Create health check table if not exists
            let opStart = Date.now();
            await client.query(\`
              CREATE TABLE IF NOT EXISTS health_check (
                id SERIAL PRIMARY KEY,
                test_id VARCHAR(50) UNIQUE NOT NULL,
                test_value INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              )
            \`);
            operationLatencies.table_creation = Date.now() - opStart;

            // Test write operation
            const testId = \`health_\${Date.now()}_\${Math.random().toString(36).substring(2, 11)}\`;
            const testValue = Math.floor(Math.random() * 1000000);
            
            opStart = Date.now();
            await client.query(
              'INSERT INTO health_check (test_id, test_value, created_at) VALUES ($1, $2, NOW())',
              [testId, testValue]
            );
            operationLatencies.write = Date.now() - opStart;

            // Test read operation
            opStart = Date.now();
            const readResult = await client.query(
              'SELECT test_value FROM health_check WHERE test_id = $1',
              [testId]
            );
            operationLatencies.read = Date.now() - opStart;

            // Verify data integrity
            const isHealthy = readResult.rows.length > 0 && readResult.rows[0].test_value === testValue;

            // Cleanup
            opStart = Date.now();
            await client.query('DELETE FROM health_check WHERE test_id = $1', [testId]);
            await client.query('DELETE FROM health_check WHERE created_at < NOW() - INTERVAL \\'1 hour\\'');
            operationLatencies.cleanup = Date.now() - opStart;

            await client.end();

            const totalLatency = Date.now() - startTime;
            
            // Publish metrics
            await publishMetric('HealthCheckLatency', totalLatency, 'Milliseconds', {
              Environment: process.env.NODE_ENV || 'dev',
              Status: isHealthy ? 'Success' : 'Error'
            });

            return {
              status: isHealthy ? 'healthy' : 'unhealthy',
              latency: totalLatency,
              operations: ['connection', 'table_creation', 'write', 'read', 'cleanup'],
              operationLatencies
            };
          } catch (error) {
            const totalLatency = Date.now() - startTime;
            await publishMetric('HealthCheckLatency', totalLatency, 'Milliseconds', {
              Environment: process.env.NODE_ENV || 'dev',
              Status: 'Error'
            });
            
            return {
              status: 'unhealthy',
              latency: totalLatency,
              error: error.message,
              operations: Object.keys(operationLatencies),
              operationLatencies
            };
          }
        };

        const checkRedis = async () => {
          const startTime = Date.now();
          
          try {
            if (!redisClient) {
              const redisSecret = await getSecret(process.env.REDIS_SECRET_ARN);
              redisClient = new Redis({
                host: redisSecret.host,
                port: redisSecret.port || 6379,
                connectTimeout: 10000,
                lazyConnect: true,
                maxRetriesPerRequest: 3,
                retryDelayOnFailover: 100
              });
            }

            // Test Redis connection
            await redisClient.ping();
            const latency = Date.now() - startTime;

            // Publish metrics
            await publishMetric('RedisHealthCheckLatency', latency, 'Milliseconds', {
              Environment: process.env.NODE_ENV || 'dev',
              Status: 'Success'
            });

            return {
              status: 'healthy',
              latency
            };
          } catch (error) {
            const latency = Date.now() - startTime;
            await publishMetric('RedisHealthCheckLatency', latency, 'Milliseconds', {
              Environment: process.env.NODE_ENV || 'dev',
              Status: 'Error'
            });
            
            return {
              status: 'unhealthy',
              latency,
              error: error.message
            };
          }
        };

        exports.handler = async (event, context) => {
          console.log('Enhanced health check called');
          const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
          
          try {
            // Run health checks in parallel
            const [databaseHealth, redisHealth] = await Promise.all([
              checkDatabase(),
              checkRedis()
            ]);

            // Determine overall status
            const allHealthy = databaseHealth.status === 'healthy' && redisHealth.status === 'healthy';
            const overallStatus = allHealthy ? 'OK' : 'DEGRADED';

            const healthData = {
              status: overallStatus,
              service: 'insurance-quotation-api',
              version: process.env.SERVICE_VERSION || '1.0.0',
              environment: process.env.NODE_ENV || '${environment}',
              region: process.env.AWS_REGION || 'unknown',
              functionName: context.functionName,
              memoryLimit: context.memoryLimitInMB,
              timestamp: new Date().toISOString(),
              checks: {
                redis: redisHealth,
                database: databaseHealth
              }
            };

            return {
              statusCode: healthData.status === 'OK' ? 200 : 503,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
              },
              body: JSON.stringify({
                data: healthData,
                timestamp: new Date().toISOString(),
                requestId
              })
            };
          } catch (error) {
            console.error('Health check failed:', error);
            return {
              statusCode: 500,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
              },
              body: JSON.stringify({
                data: {
                  status: 'ERROR',
                  service: 'insurance-quotation-api',
                  error: error.message,
                  timestamp: new Date().toISOString()
                },
                requestId
              })
            };
          }
        };
      `),
      role: this.lambdaRole,
      layers: [this.sharedLayer],
      vpc: _vpc,
      vpcSubnets: _lambdaSubnets,
      securityGroups: [_lambdaSecurityGroup],
      environment: {
        NODE_ENV: environment,
        LOG_LEVEL: environment === 'prod' ? 'info' : 'debug',
        FUNCTION_NAME: 'health',
        DATABASE_SECRET_ARN: _databaseSecretArn,
        REDIS_SECRET_ARN: _redisSecretArn,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512, // Increased memory for database operations
      logGroup: this.logGroup,
      description: 'Enhanced health check with database and Redis connectivity tests',
    });

    this.lambdaFunctions.push(healthFunction);

    // Create API Gateway integration for health check
    const healthResource = this.getOrCreateApiResource('/api/v1/health');
    const healthIntegration = new apigateway.LambdaIntegration(healthFunction, {
      proxy: true,
    });
    healthResource.addMethod('GET', healthIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    // TODO: Add other Lambda functions (quotes, etc.) once health check is working
  }

  /**
   * Get or create API Gateway resource for a path
   */
  private getOrCreateApiResource(path: string): apigateway.IResource {
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