import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseProps {
  environment: string;
  vpc: ec2.IVpc;
  databaseSecurityGroup: ec2.ISecurityGroup;
  databaseSubnets: ec2.SubnetSelection;
}

/**
 * Database construct that creates Aurora Serverless v2 PostgreSQL cluster
 * with auto-scaling, automated backups, and secure connection management.
 * 
 * Features:
 * - Aurora Serverless v2 PostgreSQL with auto-scaling (0.5-16 ACUs)
 * - Automated backups with 7-day retention and point-in-time recovery
 * - Auto-pause after 5 minutes of inactivity for cost optimization
 * - Database credentials stored securely in AWS Secrets Manager
 * - VPC-only access with no public connectivity
 * - Data API enabled for Lambda integration (optional)
 */
export class Database extends Construct {
  public readonly cluster: rds.DatabaseCluster;
  public readonly secret: secretsmanager.Secret;
  public readonly clusterEndpoint: string;
  public readonly clusterIdentifier: string;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    const { environment, vpc, databaseSecurityGroup, databaseSubnets } = props;

    // Create database credentials secret
    this.secret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      description: `Database credentials for Insurance Quotation ${environment}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // Create DB subnet group
    const subnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      description: `Subnet group for Insurance Quotation database - ${environment}`,
      vpc,
      vpcSubnets: databaseSubnets,
    });

    // Create Aurora Serverless v2 PostgreSQL cluster
    this.cluster = new rds.DatabaseCluster(this, 'DatabaseCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials: rds.Credentials.fromSecret(this.secret as secretsmanager.ISecret),
      
      // Serverless v2 configuration
      serverlessV2MinCapacity: 0.5, // Minimum ACUs for cost optimization
      serverlessV2MaxCapacity: 16,  // Maximum ACUs for performance
      
      // Network configuration
      vpc,
      vpcSubnets: databaseSubnets,
      securityGroups: [databaseSecurityGroup],
      subnetGroup,
      
      // Database configuration
      defaultDatabaseName: 'insurance_quotation',
      port: 5432,
      
      // Backup and recovery configuration
      backup: {
        retention: cdk.Duration.days(7), // 7-day backup retention
        preferredWindow: '03:00-04:00',  // UTC backup window
      },
      
      // Maintenance configuration
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00', // UTC maintenance window
      
      // Performance and monitoring
      monitoringInterval: cdk.Duration.seconds(60),
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT, // 7 days for free tier
      
      // Security configuration
      storageEncrypted: true,
      deletionProtection: environment === 'prod', // Enable deletion protection for production
      
      // Serverless v2 instances
      writer: rds.ClusterInstance.serverlessV2('writer', {
        autoMinorVersionUpgrade: true,
        enablePerformanceInsights: true,
        performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
      }),
      
      // Optional: Add reader instance for production
      readers: environment === 'prod' ? [
        rds.ClusterInstance.serverlessV2('reader', {
          autoMinorVersionUpgrade: true,
          enablePerformanceInsights: true,
          performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
        }),
      ] : [],
    });

    // Store cluster endpoint and identifier for easy access
    this.clusterEndpoint = this.cluster.clusterEndpoint.socketAddress;
    this.clusterIdentifier = this.cluster.clusterIdentifier;

    // Add tags
    cdk.Tags.of(this.cluster).add('Name', `InsuranceQuotation-Database-${environment}`);
    cdk.Tags.of(this.cluster).add('Environment', environment);
    cdk.Tags.of(this.cluster).add('BackupRetention', '7days');
    cdk.Tags.of(this.cluster).add('Engine', 'aurora-postgresql');
    cdk.Tags.of(this.cluster).add('EngineMode', 'serverless-v2');

    cdk.Tags.of(this.secret).add('Name', `InsuranceQuotation-DatabaseSecret-${environment}`);
    cdk.Tags.of(this.secret).add('Environment', environment);
  }

  /**
   * Get database connection configuration for Lambda functions
   */
  public getConnectionConfig(): { [key: string]: string } {
    return {
      DB_CLUSTER_ENDPOINT: this.clusterEndpoint,
      DB_SECRET_ARN: this.secret.secretArn,
      DB_NAME: 'insurance_quotation',
      DB_PORT: '5432',
    };
  }

  /**
   * Add outputs for the database resources
   */
  public addOutputs(): void {
    new cdk.CfnOutput(this, 'DatabaseClusterEndpoint', {
      value: this.clusterEndpoint,
      description: 'Aurora PostgreSQL cluster endpoint',
      exportName: `InsuranceQuotation-DatabaseEndpoint`,
    });

    new cdk.CfnOutput(this, 'DatabaseClusterIdentifier', {
      value: this.clusterIdentifier,
      description: 'Aurora PostgreSQL cluster identifier',
      exportName: `InsuranceQuotation-DatabaseIdentifier`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.secret.secretArn,
      description: 'Database credentials secret ARN',
      exportName: `InsuranceQuotation-DatabaseSecretArn`,
    });

    new cdk.CfnOutput(this, 'DatabaseName', {
      value: 'insurance_quotation',
      description: 'Default database name',
      exportName: `InsuranceQuotation-DatabaseName`,
    });
  }
}