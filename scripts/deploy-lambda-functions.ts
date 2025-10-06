#!/usr/bin/env node

/**
 * Manual Lambda function deployment script
 * This script deploys Lambda functions to the existing API Gateway
 * when the automatic route generation is not working
 */

import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// AWS Configuration
const region = process.env.AWS_REGION || 'us-east-1';
const environment = process.env.TARGET_ENV || 'dev';
const stackName = `InsuranceQuotation-${environment}`;

AWS.config.update({ region });

const lambda = new AWS.Lambda();
const apigateway = new AWS.APIGateway();
const cloudformation = new AWS.CloudFormation();

interface LambdaFunction {
  name: string;
  path: string;
  method: string;
  apiPath: string;
  handler: string;
  description: string;
}

// Define Lambda functions to deploy
const lambdaFunctions: LambdaFunction[] = [
  {
    name: 'health',
    path: 'src/lambda/health',
    method: 'GET',
    apiPath: '/api/v1/health',
    handler: 'handler.handler',
    description: 'Health check endpoint'
  },
  {
    name: 'quotes-create',
    path: 'src/lambda/quotes',
    method: 'POST',
    apiPath: '/api/v1/quotes',
    handler: 'create.handler',
    description: 'Create insurance quote'
  },
  {
    name: 'quotes-get',
    path: 'src/lambda/quotes',
    method: 'GET',
    apiPath: '/api/v1/quotes/{id}',
    handler: 'get.handler',
    description: 'Get insurance quote by ID'
  }
];

async function getStackOutputs(): Promise<{ [key: string]: string }> {
  console.log(`Getting stack outputs for ${stackName}...`);
  
  const result = await cloudformation.describeStacks({
    StackName: stackName
  }).promise();
  
  const outputs: { [key: string]: string } = {};
  
  if (result.Stacks && result.Stacks[0] && result.Stacks[0].Outputs) {
    for (const output of result.Stacks[0].Outputs) {
      if (output.OutputKey && output.OutputValue) {
        outputs[output.OutputKey] = output.OutputValue;
      }
    }
  }
  
  return outputs;
}

async function createLambdaFunction(func: LambdaFunction, outputs: { [key: string]: string }): Promise<string> {
  const functionName = `insurance-quotation-${environment}-${func.name}`;
  
  console.log(`Creating Lambda function: ${functionName}`);
  
  // Create deployment package
  const zipPath = await createDeploymentPackage(func);
  
  try {
    // Check if function exists
    try {
      await lambda.getFunction({ FunctionName: functionName }).promise();
      console.log(`Function ${functionName} exists, updating...`);
      
      // Update function code
      await lambda.updateFunctionCode({
        FunctionName: functionName,
        ZipFile: fs.readFileSync(zipPath)
      }).promise();
      
    } catch (error: any) {
      if (error.code === 'ResourceNotFoundException') {
        console.log(`Function ${functionName} does not exist, creating...`);
        
        // Create new function
        await lambda.createFunction({
          FunctionName: functionName,
          Runtime: 'nodejs20.x',
          Role: outputs['ServerlessAppLambdaRoleArn09A8F06E'],
          Handler: func.handler,
          Code: {
            ZipFile: fs.readFileSync(zipPath)
          },
          Description: func.description,
          Timeout: 30,
          MemorySize: 256,
          Environment: {
            Variables: {
              NODE_ENV: environment,
              FUNCTION_NAME: func.name
            }
          },
          Layers: [outputs['LambdaLayerSharedLayerArnE7E8F5A5']]
        }).promise();
      } else {
        throw error;
      }
    }
    
    // Clean up zip file
    fs.unlinkSync(zipPath);
    
    return functionName;
    
  } catch (error) {
    console.error(`Error creating/updating Lambda function ${functionName}:`, error);
    throw error;
  }
}

async function createDeploymentPackage(func: LambdaFunction): Promise<string> {
  const tempDir = path.join(__dirname, '..', 'temp', func.name);
  const zipPath = path.join(__dirname, '..', 'temp', `${func.name}.zip`);
  
  // Create temp directory
  execSync(`mkdir -p "${tempDir}"`, { stdio: 'inherit' });
  
  // Copy function files
  execSync(`cp -r "${func.path}"/* "${tempDir}/"`, { stdio: 'inherit' });
  
  // Copy shared files
  execSync(`cp -r "src/lambda/shared" "${tempDir}/"`, { stdio: 'inherit' });
  
  // Copy database files
  execSync(`cp -r "src/database" "${tempDir}/"`, { stdio: 'inherit' });
  
  // Create zip file
  execSync(`cd "${tempDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
  
  // Clean up temp directory
  execSync(`rm -rf "${tempDir}"`, { stdio: 'inherit' });
  
  return zipPath;
}

async function createApiGatewayIntegration(
  func: LambdaFunction, 
  functionName: string, 
  outputs: { [key: string]: string }
): Promise<void> {
  const apiId = outputs['ServerlessAppApiGatewayId595687C3'];
  
  console.log(`Creating API Gateway integration for ${func.apiPath} -> ${functionName}`);
  
  try {
    // Get API resources
    const resources = await apigateway.getResources({ restApiId: apiId }).promise();
    
    // Find or create resource
    const resourceId = await findOrCreateResource(apiId, func.apiPath, resources.items || []);
    
    // Create method
    try {
      await apigateway.putMethod({
        restApiId: apiId,
        resourceId: resourceId,
        httpMethod: func.method,
        authorizationType: 'NONE'
      }).promise();
    } catch (error: any) {
      if (error.code !== 'ConflictException') {
        throw error;
      }
      console.log(`Method ${func.method} already exists on resource ${resourceId}`);
    }
    
    // Create integration
    const functionArn = `arn:aws:lambda:${region}:${outputs['Account']}:function:${functionName}`;
    
    await apigateway.putIntegration({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: func.method,
      type: 'AWS_PROXY',
      integrationHttpMethod: 'POST',
      uri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`
    }).promise();
    
    // Add Lambda permission
    try {
      await lambda.addPermission({
        FunctionName: functionName,
        StatementId: `apigateway-${func.method}-${Date.now()}`,
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
        SourceArn: `arn:aws:execute-api:${region}:${outputs['Account']}:${apiId}/*/${func.method}${func.apiPath.replace('{id}', '*')}`
      }).promise();
    } catch (error: any) {
      if (error.code !== 'ResourceConflictException') {
        console.warn(`Warning: Could not add Lambda permission: ${error.message}`);
      }
    }
    
    console.log(`✅ Created integration for ${func.method} ${func.apiPath}`);
    
  } catch (error) {
    console.error(`Error creating API Gateway integration:`, error);
    throw error;
  }
}

async function findOrCreateResource(
  apiId: string, 
  path: string, 
  existingResources: AWS.APIGateway.Resource[]
): Promise<string> {
  const pathParts = path.split('/').filter(part => part.length > 0);
  let currentPath = '';
  let parentId = '';
  
  // Find root resource
  const rootResource = existingResources.find(r => r.path === '/');
  if (!rootResource || !rootResource.id) {
    throw new Error('Root resource not found');
  }
  
  parentId = rootResource.id;
  
  for (const part of pathParts) {
    currentPath += '/' + part;
    
    // Check if resource exists
    let resource = existingResources.find(r => r.path === currentPath);
    
    if (!resource) {
      console.log(`Creating resource: ${currentPath}`);
      
      const result = await apigateway.createResource({
        restApiId: apiId,
        parentId: parentId,
        pathPart: part
      }).promise();
      
      if (!result.id) {
        throw new Error(`Failed to create resource: ${currentPath}`);
      }
      
      parentId = result.id;
    } else {
      if (!resource.id) {
        throw new Error(`Resource ID not found for: ${currentPath}`);
      }
      parentId = resource.id;
    }
  }
  
  return parentId;
}

async function deployApi(outputs: { [key: string]: string }): Promise<void> {
  const apiId = outputs['ServerlessAppApiGatewayId595687C3'];
  
  console.log('Deploying API Gateway...');
  
  await apigateway.createDeployment({
    restApiId: apiId,
    stageName: environment,
    description: `Deployment at ${new Date().toISOString()}`
  }).promise();
  
  console.log('✅ API Gateway deployed successfully');
}

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting Lambda function deployment...');
    
    // Create temp directory
    execSync('mkdir -p temp', { stdio: 'inherit' });
    
    // Get stack outputs
    const outputs = await getStackOutputs();
    console.log('Stack outputs retrieved');
    
    // Deploy each Lambda function
    for (const func of lambdaFunctions) {
      console.log(`\n📦 Deploying ${func.name}...`);
      
      const functionName = await createLambdaFunction(func, outputs);
      await createApiGatewayIntegration(func, functionName, outputs);
    }
    
    // Deploy API Gateway
    await deployApi(outputs);
    
    console.log('\n✅ All Lambda functions deployed successfully!');
    console.log(`\nAPI URL: ${outputs['ServerlessAppApiGatewayUrl426EB626']}`);
    console.log('\nEndpoints:');
    for (const func of lambdaFunctions) {
      console.log(`  ${func.method} ${func.apiPath}`);
    }
    
    // Clean up
    execSync('rm -rf temp', { stdio: 'inherit' });
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}