# Docker Bundling Fix

## Issue Identified
CDK synthesis was failing with Docker-related errors:
```
docker: error during connect: Head "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/_ping": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
ValidationError: Failed to bundle asset InsuranceQuotation-dev/ServerlessApp/SharedDependenciesLayer/Code/Stage
```

## Root Cause
1. **Lambda Layer Bundling**: The `ServerlessApp` construct creates a Lambda layer that requires Docker bundling
2. **CodeBuild Configuration**: The CodeBuild project had `privileged: false`, which prevents Docker access
3. **Shell Script Syntax**: Multi-line if statements in buildspec were causing syntax errors

## Solutions Applied

### 1. Enabled Docker Support
```typescript
// Before:
privileged: false, // Don't need Docker for our build

// After:
privileged: true, // Need Docker for Lambda layer bundling
```

### 2. Fixed Shell Script Syntax
Converted multi-line if statements to single-line commands to avoid CodeBuild parsing issues:

```yaml
# Before (problematic):
- 'if [ "$STAGE" = "deploy-dev" ] || [ "$STAGE" = "deploy-prod" ]; then'
- '  echo "Deploying..."'
- 'else'
- '  echo "Skipping..."'
- 'fi'

# After (working):
- 'if [ "$STAGE" = "deploy-dev" ] || [ "$STAGE" = "deploy-prod" ]; then echo "Deploying..." && cdk deploy; else echo "Skipping..."; fi'
```

## Lambda Layer Details
The failing component was the SharedDependenciesLayer:
```typescript
this.sharedLayer = new lambda.LayerVersion(this, 'SharedDependenciesLayer', {
  code: lambda.Code.fromAsset('layers/shared-dependencies', {
    bundling: {
      image: lambda.Runtime.NODEJS_20_X.bundlingImage,
      command: ['bash', '-c', [
        'mkdir -p /asset-output/nodejs',
        'cp package*.json /asset-output/nodejs/',
        'cd /asset-output/nodejs',
        'npm ci --only=production',
        'rm package*.json',
      ].join(' && ')],
    },
  }),
});
```

This layer bundles shared Node.js dependencies for Lambda functions, which requires Docker to create the proper runtime environment.

## Expected Results
With these fixes, the pipeline should now:
1. ✅ Successfully install npm dependencies (with fallback)
2. ✅ Bundle Lambda layers using Docker
3. ✅ Synthesize CDK infrastructure without errors
4. ✅ Deploy the serverless application successfully

## Deployment Status
- Pipeline updated successfully in 72.64s
- Docker support now enabled in CodeBuild
- Shell script syntax issues resolved
- Ready for next pipeline execution

## Key Insight
When using CDK constructs that require Docker bundling (like Lambda layers), the CodeBuild environment must have `privileged: true` to access Docker daemon. This is a common requirement for serverless applications with bundled dependencies.