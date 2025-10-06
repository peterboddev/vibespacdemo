import { CloudWatchClient, PutMetricDataCommand, MetricDatum } from '@aws-sdk/client-cloudwatch';

let cloudWatchClient: CloudWatchClient | null = null;

/**
 * Get or create CloudWatch client
 */
function getCloudWatchClient(): CloudWatchClient {
  if (!cloudWatchClient) {
    cloudWatchClient = new CloudWatchClient({ 
      region: process.env['AWS_REGION'] || 'us-east-1' 
    });
  }
  return cloudWatchClient;
}

/**
 * Publish a metric to CloudWatch
 */
export async function publishMetric(
  metricName: string,
  value: number,
  unit: 'Count' | 'Milliseconds' | 'Seconds' | 'Percent' = 'Count',
  dimensions: { [key: string]: string } = {}
): Promise<void> {
  try {
    const client = getCloudWatchClient();
    
    const metricData: MetricDatum = {
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: Object.entries(dimensions).map(([name, value]) => ({
        Name: name,
        Value: value
      }))
    };

    const command = new PutMetricDataCommand({
      Namespace: 'InsuranceQuotation/Database',
      MetricData: [metricData]
    });

    await client.send(command);
  } catch (error) {
    console.error('Failed to publish metric to CloudWatch:', error);
    // Don't throw - metrics failures shouldn't break the application
  }
}

/**
 * Publish multiple metrics at once
 */
export async function publishMetrics(metrics: Array<{
  name: string;
  value: number;
  unit?: 'Count' | 'Milliseconds' | 'Seconds' | 'Percent';
  dimensions?: { [key: string]: string };
}>): Promise<void> {
  try {
    const client = getCloudWatchClient();
    
    const metricData: MetricDatum[] = metrics.map(metric => ({
      MetricName: metric.name,
      Value: metric.value,
      Unit: metric.unit || 'Count',
      Timestamp: new Date(),
      Dimensions: Object.entries(metric.dimensions || {}).map(([name, value]) => ({
        Name: name,
        Value: value
      }))
    }));

    const command = new PutMetricDataCommand({
      Namespace: 'InsuranceQuotation/Database',
      MetricData: metricData
    });

    await client.send(command);
  } catch (error) {
    console.error('Failed to publish metrics to CloudWatch:', error);
    // Don't throw - metrics failures shouldn't break the application
  }
}

/**
 * Database-specific metric helpers
 */
export const DatabaseMetrics = {
  /**
   * Record database operation latency
   */
  recordLatency: async (operation: string, latencyMs: number, success: boolean = true) => {
    const environment = process.env['NODE_ENV'] || 'development';
    
    await publishMetrics([
      {
        name: 'OperationLatency',
        value: latencyMs,
        unit: 'Milliseconds',
        dimensions: {
          Operation: operation,
          Environment: environment,
          Status: success ? 'Success' : 'Error'
        }
      },
      {
        name: 'OperationCount',
        value: 1,
        unit: 'Count',
        dimensions: {
          Operation: operation,
          Environment: environment,
          Status: success ? 'Success' : 'Error'
        }
      }
    ]);
  },

  /**
   * Record health check metrics
   */
  recordHealthCheck: async (
    overallLatencyMs: number,
    operationLatencies: { [operation: string]: number },
    success: boolean = true
  ) => {
    const environment = process.env['NODE_ENV'] || 'development';
    
    const metrics = [
      {
        name: 'HealthCheckLatency',
        value: overallLatencyMs,
        unit: 'Milliseconds' as const,
        dimensions: {
          Environment: environment,
          Status: success ? 'Success' : 'Error'
        }
      },
      {
        name: 'HealthCheckCount',
        value: 1,
        unit: 'Count' as const,
        dimensions: {
          Environment: environment,
          Status: success ? 'Success' : 'Error'
        }
      }
    ];

    // Add individual operation latencies
    for (const [operation, latency] of Object.entries(operationLatencies)) {
      metrics.push({
        name: 'HealthCheckOperationLatency',
        value: latency,
        unit: 'Milliseconds' as const,
        dimensions: {
          Operation: operation,
          Environment: environment,
          Status: success ? 'Success' : 'Error'
        }
      });
    }

    await publishMetrics(metrics);
  },

  /**
   * Record connection pool metrics
   */
  recordConnectionPool: async (totalConnections: number, idleConnections: number, waitingClients: number) => {
    const environment = process.env['NODE_ENV'] || 'development';
    
    await publishMetrics([
      {
        name: 'ConnectionPoolTotal',
        value: totalConnections,
        unit: 'Count',
        dimensions: { Environment: environment }
      },
      {
        name: 'ConnectionPoolIdle',
        value: idleConnections,
        unit: 'Count',
        dimensions: { Environment: environment }
      },
      {
        name: 'ConnectionPoolWaiting',
        value: waitingClients,
        unit: 'Count',
        dimensions: { Environment: environment }
      }
    ]);
  }
};

/**
 * Redis-specific metric helpers
 */
export const RedisMetrics = {
  /**
   * Record Redis operation latency
   */
  recordLatency: async (operation: string, latencyMs: number, success: boolean = true) => {
    const environment = process.env['NODE_ENV'] || 'development';
    
    await publishMetrics([
      {
        name: 'RedisOperationLatency',
        value: latencyMs,
        unit: 'Milliseconds',
        dimensions: {
          Operation: operation,
          Environment: environment,
          Status: success ? 'Success' : 'Error'
        }
      },
      {
        name: 'RedisOperationCount',
        value: 1,
        unit: 'Count',
        dimensions: {
          Operation: operation,
          Environment: environment,
          Status: success ? 'Success' : 'Error'
        }
      }
    ]);
  },

  /**
   * Record Redis health check metrics
   */
  recordHealthCheck: async (latencyMs: number, success: boolean = true) => {
    const environment = process.env['NODE_ENV'] || 'development';
    
    await publishMetrics([
      {
        name: 'RedisHealthCheckLatency',
        value: latencyMs,
        unit: 'Milliseconds',
        dimensions: {
          Environment: environment,
          Status: success ? 'Success' : 'Error'
        }
      },
      {
        name: 'RedisHealthCheckCount',
        value: 1,
        unit: 'Count',
        dimensions: {
          Environment: environment,
          Status: success ? 'Success' : 'Error'
        }
      }
    ]);
  }
};