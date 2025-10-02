import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkingProps {
  environment: string;
}

/**
 * Networking construct that creates a secure VPC infrastructure for the Insurance Quotation API.
 * 
 * Security Features:
 * - Database access restricted to VPC CIDR block only (no public internet access)
 * - Lambda functions deployed inside VPC with single NAT Gateway for cost optimization
 * - Private subnets for Lambda, database and cache resources across multiple AZs
 * - VPC endpoints for AWS services to reduce internet traffic and improve security
 * - Separate security groups for each component with minimal required permissions
 */

export class Networking extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly redisSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkingProps) {
    super(scope, id);

    // Create VPC with private subnets for Lambda, RDS, and Redis across multiple AZs
    this.vpc = new ec2.Vpc(this, 'InsuranceQuotationVpc', {
      maxAzs: 2, // Use 2 AZs for high availability
      cidr: '10.0.0.0/16',
      natGateways: 1, // Single NAT Gateway for cost optimization
      natGatewayProvider: ec2.NatProvider.gateway(), // Let CDK create EIP automatically
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Lambda',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 26,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
          cidrMask: 26,
          name: 'Cache',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // Create VPC endpoints for AWS services to reduce costs and improve security
    this.createVpcEndpoints();

    // Create security groups (Lambda first since others reference it)
    this.lambdaSecurityGroup = this.createLambdaSecurityGroup();
    this.databaseSecurityGroup = this.createDatabaseSecurityGroup();
    this.redisSecurityGroup = this.createRedisSecurityGroup();

    // Add tags
    cdk.Tags.of(this.vpc).add('Name', `InsuranceQuotation-VPC-${props.environment}`);
    cdk.Tags.of(this.vpc).add('Environment', props.environment);
  }

  private createVpcEndpoints(): void {
    // S3 Gateway endpoint (free)
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // Interface endpoints for AWS services (cost-optimized selection)
    const interfaceEndpoints = [
      {
        name: 'SecretsManager',
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      },
      {
        name: 'CloudWatchLogs',
        service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      },
    ];

    interfaceEndpoints.forEach(endpoint => {
      this.vpc.addInterfaceEndpoint(endpoint.name, {
        service: endpoint.service,
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        privateDnsEnabled: true,
      });
    });
  }

  private createDatabaseSecurityGroup(): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc as ec2.IVpc,
      description: 'Security group for Aurora PostgreSQL database',
      allowAllOutbound: false,
    });

    // Allow PostgreSQL access from Lambda security group
    sg.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'PostgreSQL access from Lambda functions'
    );

    cdk.Tags.of(sg).add('Name', 'InsuranceQuotation-Database-SG');
    return sg;
  }

  private createLambdaSecurityGroup(): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc as ec2.IVpc,
      description: 'Security group for Lambda functions in VPC',
      allowAllOutbound: true, // Allow outbound for internet access via NAT Gateway
    });

    cdk.Tags.of(sg).add('Name', 'InsuranceQuotation-Lambda-SG');
    return sg;
  }

  private createRedisSecurityGroup(): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: this.vpc as ec2.IVpc,
      description: 'Security group for ElastiCache Redis',
      allowAllOutbound: false,
    });

    // Allow Redis access from Lambda security group
    sg.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(6379),
      'Redis access from Lambda functions'
    );

    cdk.Tags.of(sg).add('Name', 'InsuranceQuotation-Redis-SG');
    return sg;
  }

  // Helper method to get Lambda subnets
  public getLambdaSubnets(): ec2.SubnetSelection {
    return {
      subnetGroupName: 'Lambda',
    };
  }

  // Helper method to get database subnets
  public getDatabaseSubnets(): ec2.SubnetSelection {
    return {
      subnetGroupName: 'Database',
    };
  }

  // Helper method to get cache subnets
  public getCacheSubnets(): ec2.SubnetSelection {
    return {
      subnetGroupName: 'Cache',
    };
  }

  // Output important networking information
  public addOutputs(): void {
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `InsuranceQuotation-VpcId`,
    });

    new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
      value: this.lambdaSecurityGroup.securityGroupId,
      description: 'Lambda Security Group ID',
      exportName: `InsuranceQuotation-LambdaSG`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecurityGroupId', {
      value: this.databaseSecurityGroup.securityGroupId,
      description: 'Database Security Group ID',
      exportName: `InsuranceQuotation-DatabaseSG`,
    });

    new cdk.CfnOutput(this, 'RedisSecurityGroupId', {
      value: this.redisSecurityGroup.securityGroupId,
      description: 'Redis Security Group ID',
      exportName: `InsuranceQuotation-RedisSG`,
    });
  }
}