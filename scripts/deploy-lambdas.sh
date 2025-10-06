#!/bin/bash

# Manual Lambda deployment script for Insurance Quotation API
# This script deploys Lambda functions when route generation is not working

set -e

# Configuration
ENVIRONMENT=${TARGET_ENV:-dev}
REGION=${AWS_REGION:-us-east-1}
STACK_NAME="InsuranceQuotation-${ENVIRONMENT}"

echo "🚀 Deploying Lambda functions for environment: $ENVIRONMENT"

# Get stack outputs
echo "📋 Getting stack outputs..."
API_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`ServerlessAppApiGatewayId595687C3`].OutputValue' \
  --output text)

LAMBDA_ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`ServerlessAppLambdaRoleArn09A8F06E`].OutputValue' \
  --output text)

LAYER_ARN=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaLayerSharedLayerArnE7E8F5A5`].OutputValue' \
  --output text)

ACCOUNT_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`Account`].OutputValue' \
  --output text)

echo "API Gateway ID: $API_ID"
echo "Lambda Role ARN: $LAMBDA_ROLE_ARN"
echo "Layer ARN: $LAYER_ARN"

# Create temp directory
mkdir -p temp

# Function to create deployment package
create_deployment_package() {
  local func_name=$1
  local func_path=$2
  local handler_file=$3
  
  echo "📦 Creating deployment package for $func_name..."
  
  # Create function directory
  mkdir -p "temp/$func_name"
  
  # Copy function files
  cp -r "$func_path"/* "temp/$func_name/"
  
  # Copy shared dependencies
  cp -r "src/lambda/shared" "temp/$func_name/"
  cp -r "src/database" "temp/$func_name/"
  
  # Create zip file
  cd "temp/$func_name"
  zip -r "../${func_name}.zip" .
  cd ../..
  
  echo "✅ Package created: temp/${func_name}.zip"
}

# Function to deploy Lambda function
deploy_lambda() {
  local func_name=$1
  local handler=$2
  local description=$3
  local zip_file=$4
  
  local full_func_name="insurance-quotation-${ENVIRONMENT}-${func_name}"
  
  echo "🔧 Deploying Lambda function: $full_func_name"
  
  # Check if function exists
  if aws lambda get-function --function-name "$full_func_name" >/dev/null 2>&1; then
    echo "Function exists, updating code..."
    aws lambda update-function-code \
      --function-name "$full_func_name" \
      --zip-file "fileb://$zip_file"
  else
    echo "Creating new function..."
    aws lambda create-function \
      --function-name "$full_func_name" \
      --runtime nodejs20.x \
      --role "$LAMBDA_ROLE_ARN" \
      --handler "$handler" \
      --zip-file "fileb://$zip_file" \
      --description "$description" \
      --timeout 30 \
      --memory-size 256 \
      --layers "$LAYER_ARN" \
      --environment "Variables={NODE_ENV=$ENVIRONMENT,FUNCTION_NAME=$func_name}"
  fi
  
  echo "✅ Lambda function deployed: $full_func_name"
}

# Function to create API Gateway method and integration
create_api_integration() {
  local func_name=$1
  local method=$2
  local path=$3
  local full_func_name="insurance-quotation-${ENVIRONMENT}-${func_name}"
  
  echo "🔗 Creating API integration for $method $path"
  
  # Get root resource ID
  ROOT_RESOURCE_ID=$(aws apigateway get-resources \
    --rest-api-id "$API_ID" \
    --query 'items[?path==`/`].id' \
    --output text)
  
  # Create resource path (simplified - assumes path structure exists)
  # For production, you'd want more robust resource creation
  
  # For health endpoint (/api/v1/health)
  if [[ "$path" == "/api/v1/health" ]]; then
    # Get api resource
    API_RESOURCE_ID=$(aws apigateway get-resources \
      --rest-api-id "$API_ID" \
      --query 'items[?pathPart==`api`].id' \
      --output text)
    
    # Get v1 resource
    V1_RESOURCE_ID=$(aws apigateway get-resources \
      --rest-api-id "$API_ID" \
      --query 'items[?pathPart==`v1`].id' \
      --output text)
    
    # Get health resource
    HEALTH_RESOURCE_ID=$(aws apigateway get-resources \
      --rest-api-id "$API_ID" \
      --query 'items[?pathPart==`health`].id' \
      --output text)
    
    RESOURCE_ID=$HEALTH_RESOURCE_ID
  fi
  
  # For quotes endpoints
  if [[ "$path" == "/api/v1/quotes" ]] || [[ "$path" == "/api/v1/quotes/{id}" ]]; then
    # Get quotes resource
    QUOTES_RESOURCE_ID=$(aws apigateway get-resources \
      --rest-api-id "$API_ID" \
      --query 'items[?pathPart==`quotes`].id' \
      --output text)
    
    if [[ "$path" == "/api/v1/quotes/{id}" ]]; then
      # Create {id} resource if it doesn't exist
      ID_RESOURCE_ID=$(aws apigateway get-resources \
        --rest-api-id "$API_ID" \
        --query 'items[?pathPart==`{id}`].id' \
        --output text)
      
      if [[ "$ID_RESOURCE_ID" == "" ]]; then
        echo "Creating {id} resource..."
        ID_RESOURCE_ID=$(aws apigateway create-resource \
          --rest-api-id "$API_ID" \
          --parent-id "$QUOTES_RESOURCE_ID" \
          --path-part "{id}" \
          --query 'id' \
          --output text)
      fi
      RESOURCE_ID=$ID_RESOURCE_ID
    else
      RESOURCE_ID=$QUOTES_RESOURCE_ID
    fi
  fi
  
  echo "Using resource ID: $RESOURCE_ID"
  
  # Create method (ignore if exists)
  aws apigateway put-method \
    --rest-api-id "$API_ID" \
    --resource-id "$RESOURCE_ID" \
    --http-method "$method" \
    --authorization-type NONE \
    --no-api-key-required 2>/dev/null || echo "Method may already exist"
  
  # Create integration
  FUNCTION_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${full_func_name}"
  
  aws apigateway put-integration \
    --rest-api-id "$API_ID" \
    --resource-id "$RESOURCE_ID" \
    --http-method "$method" \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${FUNCTION_ARN}/invocations"
  
  # Add Lambda permission
  aws lambda add-permission \
    --function-name "$full_func_name" \
    --statement-id "apigateway-${method}-$(date +%s)" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/${method}${path//\{id\}/\*}" \
    2>/dev/null || echo "Permission may already exist"
  
  echo "✅ API integration created for $method $path"
}

# Deploy Health Function
echo "\n📋 Deploying Health Function..."
create_deployment_package "health" "src/lambda/health" "handler"
deploy_lambda "health" "handler.handler" "Health check endpoint" "temp/health.zip"
create_api_integration "health" "GET" "/api/v1/health"

# Deploy Create Quote Function
echo "\n💰 Deploying Create Quote Function..."
create_deployment_package "quotes-create" "src/lambda/quotes" "create"
deploy_lambda "quotes-create" "create.handler" "Create insurance quote" "temp/quotes-create.zip"
create_api_integration "quotes-create" "POST" "/api/v1/quotes"

# Deploy Get Quote Function
echo "\n📄 Deploying Get Quote Function..."
create_deployment_package "quotes-get" "src/lambda/quotes" "get"
deploy_lambda "quotes-get" "get.handler" "Get insurance quote by ID" "temp/quotes-get.zip"
create_api_integration "quotes-get" "GET" "/api/v1/quotes/{id}"

# Deploy API Gateway
echo "\n🚀 Deploying API Gateway..."
aws apigateway create-deployment \
  --rest-api-id "$API_ID" \
  --stage-name "$ENVIRONMENT" \
  --description "Deployment at $(date)"

# Get API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`ServerlessAppApiGatewayUrl426EB626`].OutputValue' \
  --output text)

echo "\n✅ Deployment completed successfully!"
echo "\nAPI URL: $API_URL"
echo "\nEndpoints:"
echo "  GET  ${API_URL}api/v1/health"
echo "  POST ${API_URL}api/v1/quotes"
echo "  GET  ${API_URL}api/v1/quotes/{id}"

# Test health endpoint
echo "\n🔍 Testing health endpoint..."
curl -s "${API_URL}api/v1/health" | jq . || echo "Health endpoint test failed"

# Clean up
rm -rf temp

echo "\n🎉 All done!"