#!/usr/bin/env node

/**
 * Build Lambda Layer Script
 * 
 * This script prepares the Lambda layer structure without requiring Docker.
 * It creates the proper nodejs/node_modules directory structure that AWS Lambda expects.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LAYER_DIR = 'layers/shared-dependencies';
const NODEJS_DIR = path.join(LAYER_DIR, 'nodejs');
const NODE_MODULES_DIR = path.join(NODEJS_DIR, 'node_modules');

console.log('🔨 Building Lambda layer for shared dependencies...');

try {
  // Clean up existing nodejs directory
  if (fs.existsSync(NODEJS_DIR)) {
    console.log('🧹 Cleaning existing nodejs directory...');
    fs.rmSync(NODEJS_DIR, { recursive: true, force: true });
  }

  // Create nodejs directory structure
  console.log('📁 Creating nodejs directory structure...');
  fs.mkdirSync(NODEJS_DIR, { recursive: true });

  // Install dependencies in the layer directory
  console.log('📦 Installing dependencies...');
  process.chdir(LAYER_DIR);
  
  // Install production dependencies only
  execSync('npm ci --omit=dev --ignore-scripts', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  // Move node_modules to the correct location for Lambda
  console.log('📂 Moving node_modules to nodejs/ directory...');
  if (fs.existsSync('node_modules')) {
    fs.renameSync('node_modules', path.join('nodejs', 'node_modules'));
  }

  // Go back to root directory
  process.chdir('../..');

  // Verify the layer structure
  console.log('✅ Verifying layer structure...');
  if (fs.existsSync(NODE_MODULES_DIR)) {
    const packages = fs.readdirSync(NODE_MODULES_DIR);
    console.log(`📋 Layer contains ${packages.length} packages:`);
    packages.slice(0, 10).forEach(pkg => console.log(`   - ${pkg}`));
    if (packages.length > 10) {
      console.log(`   ... and ${packages.length - 10} more`);
    }
  }

  // Check layer size
  const getDirectorySize = (dirPath) => {
    let totalSize = 0;
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  };

  const layerSize = getDirectorySize(NODEJS_DIR);
  const layerSizeMB = (layerSize / (1024 * 1024)).toFixed(2);
  console.log(`📏 Layer size: ${layerSizeMB} MB`);

  if (layerSize > 250 * 1024 * 1024) { // 250 MB limit
    console.warn('⚠️  Warning: Layer size exceeds 250 MB limit for Lambda layers');
  }

  console.log('🎉 Lambda layer built successfully!');
  console.log('');
  console.log('Layer structure:');
  console.log(`${LAYER_DIR}/`);
  console.log('├── package.json');
  console.log('└── nodejs/');
  console.log('    └── node_modules/');
  console.log('        ├── @aws-sdk/');
  console.log('        ├── ioredis/');
  console.log('        ├── pg/');
  console.log('        └── ...');

} catch (error) {
  console.error('❌ Error building Lambda layer:', error.message);
  process.exit(1);
}