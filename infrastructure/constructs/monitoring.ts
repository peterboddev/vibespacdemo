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
   * Helper method to create a graph widget with consistent properties
   */
  private createGraphWidget(config: {
    title: string;
    width?: number;
    height?: number;
    left?: cloudwatch.IMetric[];
    right?: cloudwatch.IMetric[];
  }): cloudwatch.IWidget {
    const widgetProps: any = {
      title: config.title,
      width: config.width || 12,
      height: config.height || 6,
      left: config.left || [],
      warnings: []
    };
    
    if (config.right) {
      widgetProps.right = config.right;
    }
    
    return new cloudwatch.GraphWidget(widgetProps) as cloudwatch.IWidget;
  }

  /**
   * Add system overview widgets
   */
  private addSystemOverviewWidgets(environment: string): void {
    // Health Check Success Rate
    const healthCheckSuccessRate = this.createGraphWidget({
      title: 'System Health Overview',
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
    const systemLatency = this.createGraphWidget({
      title: 'System Response Times',
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
    const dbOperationLatencies = this.createGraphWidget({
      title: 'Database Operation Latencies',
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
        })
      ]
    });

    this.dashboard.addWidgets(dbOperationLatencies);
  }

  /**
   * Add Redis-specific metrics widgets
   */
  private addRedisMetricsWidgets(environment: string): void {
    // Redis Performance
    const redisLatencies = this.createGraphWidget({
      title: 'Redis Performance',
      left: [
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

    this.dashboard.addWidgets(redisLatencies);
  }

  /**
   * Add Lambda function metrics widgets
   */
  private addLambdaMetricsWidgets(lambdaFunctions: lambda.Function[], _environment: string): void {
    if (lambdaFunctions.length === 0) return;

    // Lambda Duration
    const lambdaDuration = this.createGraphWidget({
      title: 'Lambda Function Duration',
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

    this.dashboard.addWidgets(lambdaDuration);
  }

  /**
   * Add API Gateway metrics widgets
   */
  private addApiGatewayMetricsWidgets(_apiGatewayId: string, environment: string): void {
    // API Gateway Latency
    const apiLatency = this.createGraphWidget({
      title: 'API Gateway Latency',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Latency',
          dimensionsMap: {
            ApiName: `insurance-quotation-${environment}`
          },
          statistic: 'Average',
          label: 'API Latency (avg)'
        })
      ]
    });

    this.dashboard.addWidgets(apiLatency);
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