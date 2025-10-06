import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface MonitoringProps {
  environment: string;
  lambdaFunctions: lambda.Function[];
  apiGatewayId: string;
}

/**
 * Monitoring construct that creates CloudWatch dashboards and alarms
 * for the Insurance Quotation API
 */
export class Monitoring extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    const { environment, lambdaFunctions, apiGatewayId } = props;

    // Create the main dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'InsuranceQuotationDashboard', {
      dashboardName: `InsuranceQuotation-${environment}`,
      defaultInterval: cdk.Duration.hours(1),
    });

    // Add widgets to the dashboard
    this.addSystemOverviewWidgets(environment);
    this.addDatabaseMetricsWidgets(environment);
    this.addRedisMetricsWidgets(environment);
    this.addLambdaMetricsWidgets(lambdaFunctions, environment);
    this.addApiGatewayMetricsWidgets(apiGatewayId, environment);

    // Add tags
    cdk.Tags.of(this).add('Project', 'InsuranceQuotation');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Component', 'Monitoring');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }

  /**
   * Add system overview widgets
   */
  private addSystemOverviewWidgets(environment: string): void {
    // Health Check Success Rate
    const healthCheckSuccessRate = new cloudwatch.GraphWidget({
      title: 'System Health Overview',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'HealthCheckCount',
          dimensionsMap: {
            Environment: environment,
            Status: 'Success'
          },
          statistic: 'Sum',
          label: 'Database Health Checks (Success)'
        }),
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'RedisHealthCheckCount',
          dimensionsMap: {
            Environment: environment,
            Status: 'Success'
          },
          statistic: 'Sum',
          label: 'Redis Health Checks (Success)'
        })
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'HealthCheckCount',
          dimensionsMap: {
            Environment: environment,
            Status: 'Error'
          },
          statistic: 'Sum',
          label: 'Database Health Checks (Error)'
        }),
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'RedisHealthCheckCount',
          dimensionsMap: {
            Environment: environment,
            Status: 'Error'
          },
          statistic: 'Sum',
          label: 'Redis Health Checks (Error)'
        })
      ]
    });

    // Overall System Latency
    const systemLatency = new cloudwatch.GraphWidget({
      title: 'System Response Times',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'HealthCheckLatency',
          dimensionsMap: {
            Environment: environment
          },
          statistic: 'Average',
          label: 'Database Health Check Latency (avg)'
        }),
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'RedisHealthCheckLatency',
          dimensionsMap: {
            Environment: environment
          },
          statistic: 'Average',
          label: 'Redis Health Check Latency (avg)'
        })
      ]
    });

    this.dashboard.addWidgets(healthCheckSuccessRate, systemLatency);
  }

  /**
   * Add database-specific metrics widgets
   */
  private addDatabaseMetricsWidgets(environment: string): void {
    // Database Operation Latencies
    const dbOperationLatencies = new cloudwatch.GraphWidget({
      title: 'Database Operation Latencies',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'HealthCheckOperationLatency',
          dimensionsMap: {
            Environment: environment,
            Operation: 'write'
          },
          statistic: 'Average',
          label: 'Write Operations (avg)'
        }),
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'HealthCheckOperationLatency',
          dimensionsMap: {
            Environment: environment,
            Operation: 'read'
          },
          statistic: 'Average',
          label: 'Read Operations (avg)'
        }),
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'HealthCheckOperationLatency',
          dimensionsMap: {
            Environment: environment,
            Operation: 'connection'
          },
          statistic: 'Average',
          label: 'Connection (avg)'
        })
      ]
    });

    // Database Operation Counts
    const dbOperationCounts = new cloudwatch.GraphWidget({
      title: 'Database Operation Counts',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'OperationCount',
          dimensionsMap: {
            Environment: environment,
            Status: 'Success'
          },
          statistic: 'Sum',
          label: 'Successful Operations'
        }),
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'OperationCount',
          dimensionsMap: {
            Environment: environment,
            Status: 'Error'
          },
          statistic: 'Sum',
          label: 'Failed Operations'
        })
      ]
    });

    // Connection Pool Metrics
    const connectionPoolMetrics = new cloudwatch.GraphWidget({
      title: 'Database Connection Pool',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'ConnectionPoolTotal',
          dimensionsMap: {
            Environment: environment
          },
          statistic: 'Average',
          label: 'Total Connections'
        }),
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'ConnectionPoolIdle',
          dimensionsMap: {
            Environment: environment
          },
          statistic: 'Average',
          label: 'Idle Connections'
        }),
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'ConnectionPoolWaiting',
          dimensionsMap: {
            Environment: environment
          },
          statistic: 'Average',
          label: 'Waiting Clients'
        })
      ]
    });

    this.dashboard.addWidgets(dbOperationLatencies, dbOperationCounts, connectionPoolMetrics);
  }

  /**
   * Add Redis-specific metrics widgets
   */
  private addRedisMetricsWidgets(environment: string): void {
    // Redis Operation Latencies
    const redisLatencies = new cloudwatch.GraphWidget({
      title: 'Redis Performance',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'RedisOperationLatency',
          dimensionsMap: {
            Environment: environment
          },
          statistic: 'Average',
          label: 'Redis Operation Latency (avg)'
        }),
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'RedisHealthCheckLatency',
          dimensionsMap: {
            Environment: environment
          },
          statistic: 'Average',
          label: 'Redis Health Check Latency (avg)'
        })
      ]
    });

    // Redis Operation Counts
    const redisOperationCounts = new cloudwatch.GraphWidget({
      title: 'Redis Operation Counts',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'RedisOperationCount',
          dimensionsMap: {
            Environment: environment,
            Status: 'Success'
          },
          statistic: 'Sum',
          label: 'Successful Operations'
        }),
        new cloudwatch.Metric({
          namespace: 'InsuranceQuotation/Database',
          metricName: 'RedisOperationCount',
          dimensionsMap: {
            Environment: environment,
            Status: 'Error'
          },
          statistic: 'Sum',
          label: 'Failed Operations'
        })
      ]
    });

    this.dashboard.addWidgets(redisLatencies, redisOperationCounts);
  }

  /**
   * Add Lambda function metrics widgets
   */
  private addLambdaMetricsWidgets(lambdaFunctions: lambda.Function[], environment: string): void {
    // Lambda Duration
    const lambdaDuration = new cloudwatch.GraphWidget({
      title: 'Lambda Function Duration',
      width: 12,
      height: 6,
      left: lambdaFunctions.map(func => 
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Duration',
          dimensionsMap: {
            FunctionName: func.functionName
          },
          statistic: 'Average',
          label: `${func.functionName} (avg)`
        })
      )
    });

    // Lambda Errors
    const lambdaErrors = new cloudwatch.GraphWidget({
      title: 'Lambda Function Errors',
      width: 12,
      height: 6,
      left: lambdaFunctions.map(func => 
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          dimensionsMap: {
            FunctionName: func.functionName
          },
          statistic: 'Sum',
          label: `${func.functionName} errors`
        })
      )
    });

    // Lambda Invocations
    const lambdaInvocations = new cloudwatch.GraphWidget({
      title: 'Lambda Function Invocations',
      width: 12,
      height: 6,
      left: lambdaFunctions.map(func => 
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Invocations',
          dimensionsMap: {
            FunctionName: func.functionName
          },
          statistic: 'Sum',
          label: `${func.functionName} invocations`
        })
      )
    });

    this.dashboard.addWidgets(lambdaDuration, lambdaErrors, lambdaInvocations);
  }

  /**
   * Add API Gateway metrics widgets
   */
  private addApiGatewayMetricsWidgets(apiGatewayId: string, environment: string): void {
    // API Gateway Latency
    const apiLatency = new cloudwatch.GraphWidget({
      title: 'API Gateway Latency',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Latency',
          dimensionsMap: {
            ApiName: `insurance-quotation-${environment}`
          },
          statistic: 'Average',
          label: 'API Latency (avg)'
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'IntegrationLatency',
          dimensionsMap: {
            ApiName: `insurance-quotation-${environment}`
          },
          statistic: 'Average',
          label: 'Integration Latency (avg)'
        })
      ]
    });

    // API Gateway Requests and Errors
    const apiRequestsAndErrors = new cloudwatch.GraphWidget({
      title: 'API Gateway Requests & Errors',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Count',
          dimensionsMap: {
            ApiName: `insurance-quotation-${environment}`
          },
          statistic: 'Sum',
          label: 'Total Requests'
        })
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '4XXError',
          dimensionsMap: {
            ApiName: `insurance-quotation-${environment}`
          },
          statistic: 'Sum',
          label: '4XX Errors'
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          dimensionsMap: {
            ApiName: `insurance-quotation-${environment}`
          },
          statistic: 'Sum',
          label: '5XX Errors'
        })
      ]
    });

    this.dashboard.addWidgets(apiLatency, apiRequestsAndErrors);
  }

  /**
   * Create CloudWatch alarms for critical metrics
   */
  public createAlarms(snsTopicArn: string): void {
    const alarmTopic = cdk.aws_sns.Topic.fromTopicArn(this, 'AlarmTopic', snsTopicArn);

    // Database health check failure alarm
    new cloudwatch.Alarm(this, 'DatabaseHealthCheckFailureAlarm', {
      alarmName: `InsuranceQuotation-DatabaseHealthFailure-${this.node.tryGetContext('environment') || 'dev'}`,
      alarmDescription: 'Database health checks are failing',
      metric: new cloudwatch.Metric({
        namespace: 'InsuranceQuotation/Database',
        metricName: 'HealthCheckCount',
        dimensionsMap: {
          Status: 'Error'
        },
        statistic: 'Sum'
      }),
      threshold: 3,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alarmTopic));

    // High database latency alarm
    new cloudwatch.Alarm(this, 'HighDatabaseLatencyAlarm', {
      alarmName: `InsuranceQuotation-HighDatabaseLatency-${this.node.tryGetContext('environment') || 'dev'}`,
      alarmDescription: 'Database operations are taking too long',
      metric: new cloudwatch.Metric({
        namespace: 'InsuranceQuotation/Database',
        metricName: 'HealthCheckLatency',
        statistic: 'Average'
      }),
      threshold: 5000, // 5 seconds
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alarmTopic));

    // Redis health check failure alarm
    new cloudwatch.Alarm(this, 'RedisHealthCheckFailureAlarm', {
      alarmName: `InsuranceQuotation-RedisHealthFailure-${this.node.tryGetContext('environment') || 'dev'}`,
      alarmDescription: 'Redis health checks are failing',
      metric: new cloudwatch.Metric({
        namespace: 'InsuranceQuotation/Database',
        metricName: 'RedisHealthCheckCount',
        dimensionsMap: {
          Status: 'Error'
        },
        statistic: 'Sum'
      }),
      threshold: 3,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alarmTopic));
  }
}