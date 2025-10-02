#!/usr/bin/env ts-node

import { generateRoutesConfig } from '../infrastructure/utils/route-generator';

/**
 * Generate routes configuration for dynamic CDK deployment
 * This script scans Lambda functions for route annotations and generates
 * a configuration file that can be used by CodeBuild for dynamic deployment
 */

console.log('🔍 Scanning Lambda functions for route annotations...');

try {
  generateRoutesConfig('infrastructure/generated/routes.json');
  console.log('✅ Routes configuration generated successfully!');
  console.log('📁 Output: infrastructure/generated/routes.json');
} catch (error) {
  console.error('❌ Failed to generate routes configuration:', error);
  process.exit(1);
}