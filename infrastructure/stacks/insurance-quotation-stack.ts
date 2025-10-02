import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { Networking } from '../constructs/networking';
import { Database } from '../constructs/database';
import { Redis } from '../constructs/redis';
import { ServerlessApp } from '../constructs/serverless-app';

export interface InsuranceQuotationStackProps extends cdk.StackProps {
  environment: string;
}

export class InsuranceQuotationStack extends cdk.Stack {
  public readonly networking: Networking;
  public readonly database: Database;
  public readonly redis: Redis;
  public readonly serverlessApp: ServerlessApp;

  constructor(scope: Construct, id: string, props: InsuranceQuotationStackProps) {
    super(scope, id, props);

    // Environment configuration
    const { environment } = props;

    // Add stack-level tags
    cdk.Tags.of(this).add('Project', 'InsuranceQuotation');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // Create networking infrastructure
    this.networking = new Networking(this, 'Networking', {
      environment,
    });

    // Create database infrastructure
    this.database = new Database(this, 'Database', {
      environment,
      vpc: this.networking.vpc as ec2.IVpc,
      databaseSecurityGroup: this.networking.databaseSecurityGroup,
      databaseSubnets: this.networking.getDatabaseSubnets(),
    });

    // Create Redis infrastructure
    this.redis = new Redis(this, 'Redis', {
      environment,
      vpc: this.networking.vpc as ec2.IVpc,
      redisSecurityGroup: this.networking.redisSecurityGroup,
      cacheSubnets: this.networking.getCacheSubnets(),
    });

    // Create serverless application infrastructure
    this.serverlessApp = new ServerlessApp(this, 'ServerlessApp', {
      environment,
      vpc: this.networking.vpc as ec2.IVpc,
      lambdaSecurityGroup: this.networking.lambdaSecurityGroup,
      lambdaSubnets: this.networking.getLambdaSubnets(),
      databaseSecretArn: this.database.secret.secretArn,
      redisSecretArn: this.redis.secret.secretArn,
    });

    // Add outputs
    this.networking.addOutputs();
    this.database.addOutputs();
    this.redis.addOutputs();
    this.serverlessApp.addOutputs();

    // Output the environment for verification
    new cdk.CfnOutput(this, 'Environment', {
      value: environment,
      description: 'Deployment environment',
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