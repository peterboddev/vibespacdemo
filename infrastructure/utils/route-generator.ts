import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

/**
 * Route annotation interface for Lambda functions
 */
export interface RouteAnnotation {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  auth?: 'required' | 'optional' | 'none';
  rateLimit?: string | undefined; // e.g., "100/hour", "10/minute"
  cors?: boolean;
  timeout?: number | undefined; // seconds
  memorySize?: number | undefined; // MB
  description?: string | undefined;
}

/**
 * Lambda function metadata extracted from source code
 */
export interface LambdaFunctionMetadata {
  functionName: string;
  filePath: string;
  handlerName: string;
  routes: RouteAnnotation[];
  dependencies?: string[];
}

/**
 * Route generator utility for dynamic CDK generation
 */
export class RouteGenerator {
  private lambdaDir: string;
  private functions: LambdaFunctionMetadata[] = [];

  constructor(lambdaDir: string = 'src/lambda') {
    this.lambdaDir = lambdaDir;
  }

  /**
   * Scan Lambda functions and extract route annotations
   */
  public scanLambdaFunctions(): LambdaFunctionMetadata[] {
    this.functions = [];
    this.scanDirectory(this.lambdaDir);
    return this.functions;
  }

  /**
   * Generate CDK constructs for API Gateway routes
   */
  public generateApiRoutes(
    api: apigateway.RestApi,
    lambdaConfig: {
      role: iam.Role;
      layers: lambda.LayerVersion[];
      vpc?: ec2.IVpc;
      securityGroups?: ec2.ISecurityGroup[];
      subnets?: ec2.SubnetSelection;
      environment?: { [key: string]: string };
    }
  ): void {
    for (const func of this.functions) {
      // Create Lambda function
      // TODO: Consider migrating to lambdaNodejs.NodejsFunction for improved TypeScript bundling
      // See docs/LAMBDA_DEPLOYMENT_ENHANCEMENTS.md for implementation details
      const lambdaFunction = new lambda.Function(api, `${func.functionName}Function`, {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: `${func.handlerName}.handler`,
        code: lambda.Code.fromAsset(path.dirname(func.filePath)),
        role: lambdaConfig.role,
        layers: lambdaConfig.layers,
        vpc: lambdaConfig.vpc,
        vpcSubnets: lambdaConfig.subnets,
        securityGroups: lambdaConfig.securityGroups,
        environment: {
          ...lambdaConfig.environment,
          FUNCTION_NAME: func.functionName,
        },
        timeout: func.routes[0]?.timeout ? 
          cdk.Duration.seconds(func.routes[0].timeout) : 
          cdk.Duration.seconds(30),
        memorySize: func.routes[0]?.memorySize || 256,
      });

      // Create API Gateway routes for each annotation
      for (const route of func.routes) {
        this.createApiRoute(api, lambdaFunction, route);
      }
    }
  }

  /**
   * Recursively scan directory for Lambda functions
   */
  private scanDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      return;
    }

    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.scanDirectory(fullPath);
      } else if (item.endsWith('.ts') || item.endsWith('.js')) {
        this.parseFile(fullPath);
      }
    }
  }

  /**
   * Parse Lambda function file for route annotations
   */
  private parseFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const routes = this.extractRouteAnnotations(content);
    
    if (routes.length > 0) {
      const functionName = this.getFunctionName(filePath);
      const handlerName = this.getHandlerName(content);
      
      this.functions.push({
        functionName,
        filePath,
        handlerName,
        routes,
        dependencies: this.extractDependencies(content),
      });
    }
  }

  /**
   * Extract route annotations from file content
   */
  private extractRouteAnnotations(content: string): RouteAnnotation[] {
    const routes: RouteAnnotation[] = [];
    const lines = content.split('\n');
    
    let currentAnnotations: Partial<RouteAnnotation> = {};
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() || '';
      
      // Look for route annotations
      if (line.startsWith('* @route ')) {
        const routeMatch = line.match(/\* @route\s+(\w+)\s+(.+)/);
        if (routeMatch && routeMatch[1] && routeMatch[2]) {
          currentAnnotations.method = routeMatch[1].toUpperCase() as any;
          currentAnnotations.path = routeMatch[2];
        }
      } else if (line.startsWith('* @auth ')) {
        const authMatch = line.match(/\* @auth\s+(\w+)/);
        if (authMatch && authMatch[1]) {
          currentAnnotations.auth = authMatch[1] as any;
        }
      } else if (line.startsWith('* @rateLimit ')) {
        const rateLimitMatch = line.match(/\* @rateLimit\s+(.+)/);
        if (rateLimitMatch && rateLimitMatch[1]) {
          currentAnnotations.rateLimit = rateLimitMatch[1];
        }
      } else if (line.startsWith('* @timeout ')) {
        const timeoutMatch = line.match(/\* @timeout\s+(\d+)/);
        if (timeoutMatch && timeoutMatch[1]) {
          currentAnnotations.timeout = parseInt(timeoutMatch[1]);
        }
      } else if (line.startsWith('* @memory ')) {
        const memoryMatch = line.match(/\* @memory\s+(\d+)/);
        if (memoryMatch && memoryMatch[1]) {
          currentAnnotations.memorySize = parseInt(memoryMatch[1]);
        }
      } else if (line.startsWith('* @description ')) {
        const descMatch = line.match(/\* @description\s+(.+)/);
        if (descMatch && descMatch[1]) {
          currentAnnotations.description = descMatch[1];
        }
      } else if (line.includes('export') && line.includes('=') && line.includes('async')) {
        // End of annotation block, save route if complete
        if (currentAnnotations.method && currentAnnotations.path) {
          routes.push({
            method: currentAnnotations.method,
            path: currentAnnotations.path,
            auth: currentAnnotations.auth || 'none',
            rateLimit: currentAnnotations.rateLimit,
            cors: true, // Default to true
            timeout: currentAnnotations.timeout,
            memorySize: currentAnnotations.memorySize,
            description: currentAnnotations.description,
          });
        }
        currentAnnotations = {};
      }
    }
    
    return routes;
  }

  /**
   * Create API Gateway route for a Lambda function
   */
  private createApiRoute(
    api: apigateway.RestApi,
    lambdaFunction: lambda.Function,
    route: RouteAnnotation
  ): void {
    // Get or create resource
    const resource = this.getOrCreateResource(api, route.path);
    
    // Create Lambda integration
    const integration = new apigateway.LambdaIntegration(lambdaFunction, {
      proxy: true,
    });
    
    // Add method to resource
    resource.addMethod(route.method, integration, {
      authorizationType: route.auth === 'required' ? 
        apigateway.AuthorizationType.IAM : 
        apigateway.AuthorizationType.NONE,
    });
  }

  /**
   * Get or create API Gateway resource for a path
   */
  private getOrCreateResource(api: apigateway.RestApi, path: string): apigateway.IResource {
    const pathParts = path.split('/').filter(part => part.length > 0);
    let resource: apigateway.IResource = api.root;
    
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
   * Extract function name from file path
   */
  private getFunctionName(filePath: string): string {
    const parts = filePath.split(path.sep);
    const fileName = parts[parts.length - 1]?.replace(/\.(ts|js)$/, '') || 'unknown';
    const dirName = parts[parts.length - 2] || 'unknown';
    
    return `${dirName}-${fileName}`;
  }

  /**
   * Extract handler name from file content
   */
  private getHandlerName(content: string): string {
    const handlerMatch = content.match(/export\s+const\s+(\w+)\s*=/);
    return handlerMatch && handlerMatch[1] ? handlerMatch[1] : 'handler';
  }

  /**
   * Extract dependencies from file content
   */
  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const importMatches = content.match(/import.*from\s+['"]([^'"]+)['"]/g);
    
    if (importMatches) {
      for (const match of importMatches) {
        const depMatch = match.match(/from\s+['"]([^'"]+)['"]/);
        if (depMatch && depMatch[1] && !depMatch[1].startsWith('.')) {
          dependencies.push(depMatch[1]);
        }
      }
    }
    
    return dependencies;
  }
}

/**
 * Generate routes configuration file for CodeBuild
 */
export function generateRoutesConfig(outputPath: string = 'infrastructure/generated/routes.json'): void {
  const generator = new RouteGenerator();
  const functions = generator.scanLambdaFunctions();
  
  const config = {
    generatedAt: new Date().toISOString(),
    functions,
    routes: functions.flatMap(func => 
      func.routes.map(route => ({
        functionName: func.functionName,
        method: route.method,
        path: route.path,
        auth: route.auth,
        rateLimit: route.rateLimit,
        timeout: route.timeout,
        memorySize: route.memorySize,
        description: route.description,
      }))
    ),
  };
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
  console.log(`Generated routes configuration: ${outputPath}`);
}