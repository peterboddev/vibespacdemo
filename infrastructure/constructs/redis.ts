import * as cdk from 'aws-cdk-lib';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface RedisProps {
  environment: string;
  vpc: ec2.IVpc;
  redisSecurityGroup: ec2.ISecurityGroup;
  cacheSubnets: ec2.SubnetSelection;
}

/**
 * Redis construct that creates ElastiCache Serverless for Redis
 * with auto-scaling, encryption, and secure connection management.
 * 
 * Features:
 * - ElastiCache Serverless for Redis with auto-scaling
 * - Data encryption in transit and at rest
 * - Connection pooling and timeout configurations
 * - Redis connection secrets stored in AWS Secrets Manager
 * - VPC-only access with security group restrictions
 * - Performance optimization for all services
 */
export class Redis extends Construct {
  public readonly serverlessCache: elasticache.CfnServerlessCache;
  public readonly secret: secretsmanager.Secret;
  public readonly cacheEndpoint: string;
  public readonly cacheName: string;

  constructor(scope: Construct, id: string, props: RedisProps) {
    super(scope, id);

    const { environment, vpc, redisSecurityGroup, cacheSubnets } = props;

    // Generate cache name (must be unique and follow naming conventions)
    this.cacheName = `insurance-quotation-${environment}`.toLowerCase();

    // Create Redis connection secret with configuration
    this.secret = new secretsmanager.Secret(this, 'RedisSecret', {
      description: `Redis connection configuration for Insurance Quotation ${environment}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          host: '', // Will be updated after cache creation
          port: 6379,
          ssl: true,
          connectTimeout: 10000,
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: true,
          // Connection pool settings
          family: 4,
          keepAlive: true,
          // Performance settings
          db: 0,
          keyPrefix: `insurance-quotation-${environment}:`
        }),
        generateStringKey: 'auth_token',
        excludeCharacters: '"@/\\\'',
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // Create subnet group for ElastiCache
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: `Subnet group for Insurance Quotation Redis - ${environment}`,
      subnetIds: vpc.selectSubnets(cacheSubnets).subnetIds,
      cacheSubnetGroupName: `insurance-quotation-redis-${environment}`,
    });

    // Create ElastiCache Serverless for Redis
    this.serverlessCache = new elasticache.CfnServerlessCache(this, 'RedisServerlessCache', {
      engine: 'redis',
      serverlessCacheName: this.cacheName,
      description: `ElastiCache Serverless Redis for Insurance Quotation ${environment}`,
      
      // Security configuration
      securityGroupIds: [redisSecurityGroup.securityGroupId],
      subnetIds: vpc.selectSubnets(cacheSubnets).subnetIds,
      
      // Performance and scaling configuration
      cacheUsageLimits: {
        dataStorage: {
          maximum: environment === 'prod' ? 100 : 50, // GB - adjust based on environment
          unit: 'GB',
        },
        ecpuPerSecond: {
          maximum: environment === 'prod' ? 15000 : 5000, // ECPU per second
        },
      },
      
      // Data tiering for cost optimization (commented out as it may not be available in all regions)
      // dataTiering: 'enabled',
      
      // Encryption configuration - using AWS managed keys
      
      // Snapshot configuration for data persistence
      snapshotRetentionLimit: environment === 'prod' ? 7 : 1,
      dailySnapshotTime: '03:00', // UTC snapshot time
      
      // Tags
      tags: [
        {
          key: 'Name',
          value: `InsuranceQuotation-Redis-${environment}`,
        },
        {
          key: 'Environment',
          value: environment,
        },
        {
          key: 'Project',
          value: 'InsuranceQuotation',
        },
        {
          key: 'ManagedBy',
          value: 'CDK',
        },
        {
          key: 'Engine',
          value: 'redis',
        },
        {
          key: 'CacheType',
          value: 'serverless',
        },
      ],
    });

    // Add dependency on subnet group
    this.serverlessCache.addDependency(subnetGroup);

    // Store cache endpoint for easy access
    this.cacheEndpoint = this.serverlessCache.attrEndpointAddress;

    // Note: Custom resource for updating secret would require a Lambda function
    // For now, we'll rely on the application to handle the endpoint resolution
    // This could be implemented later with a proper custom resource Lambda

    // Add tags to secret
    cdk.Tags.of(this.secret).add('Name', `InsuranceQuotation-RedisSecret-${environment}`);
    cdk.Tags.of(this.secret).add('Environment', environment);
    cdk.Tags.of(this.secret).add('Project', 'InsuranceQuotation');
  }

  /**
   * Get Redis connection configuration for Lambda functions
   */
  public getConnectionConfig(): { [key: string]: string } {
    return {
      REDIS_ENDPOINT: this.cacheEndpoint,
      REDIS_SECRET_ARN: this.secret.secretArn,
      REDIS_PORT: '6379',
      REDIS_SSL: 'true',
      REDIS_KEY_PREFIX: `insurance-quotation-${this.node.tryGetContext('environment') || 'dev'}:`,
    };
  }

  /**
   * Add outputs for the Redis resources
   */
  public addOutputs(): void {
    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.cacheEndpoint,
      description: 'ElastiCache Serverless Redis endpoint',
      exportName: `InsuranceQuotation-RedisEndpoint`,
    });

    new cdk.CfnOutput(this, 'RedisCacheName', {
      value: this.cacheName,
      description: 'ElastiCache Serverless Redis cache name',
      exportName: `InsuranceQuotation-RedisCacheName`,
    });

    new cdk.CfnOutput(this, 'RedisSecretArn', {
      value: this.secret.secretArn,
      description: 'Redis connection configuration secret ARN',
      exportName: `InsuranceQuotation-RedisSecretArn`,
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: '6379',
      description: 'Redis port',
      exportName: `InsuranceQuotation-RedisPort`,
    });
  }
}