export interface EnvironmentConfig {
  account?: string;
  region: string;
  environment: string;
  tags: Record<string, string>;
}

export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    region: 'us-east-1',
    environment: 'dev',
    tags: {
      Environment: 'dev',
      Project: 'InsuranceQuotation',
      Owner: 'Development Team',
    },
  },
  test: {
    region: 'us-east-1',
    environment: 'test',
    tags: {
      Environment: 'test',
      Project: 'InsuranceQuotation',
      Owner: 'QA Team',
    },
  },
  prod: {
    region: 'us-east-1',
    environment: 'prod',
    tags: {
      Environment: 'prod',
      Project: 'InsuranceQuotation',
      Owner: 'Operations Team',
    },
  },
};

export function getEnvironmentConfig(env: string): EnvironmentConfig {
  const config = environments[env];
  if (!config) {
    throw new Error(`Unknown environment: ${env}. Available environments: ${Object.keys(environments).join(', ')}`);
  }
  
  // Override account from environment variable if provided
  if (process.env['CDK_DEFAULT_ACCOUNT']) {
    config.account = process.env['CDK_DEFAULT_ACCOUNT'];
  }
  
  // Override region from environment variable if provided
  if (process.env['CDK_DEFAULT_REGION']) {
    config.region = process.env['CDK_DEFAULT_REGION'];
  }
  
  return config;
}