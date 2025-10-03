#!/usr/bin/env node

/**
 * Prepare Lambda Deployment Package
 * 
 * This script prepares the Lambda deployment package by copying
 * the compiled JavaScript files and necessary node_modules.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LAMBDA_DIST_DIR = 'dist-lambda';
const REQUIRED_MODULES = [
  'ioredis',
  'pg',
  '@aws-sdk/client-secrets-manager',
  '@aws-sdk/client-rds'
];

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDirectory(src, dest) {
  ensureDirectoryExists(dest);
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyNodeModule(moduleName, destDir) {
  const srcPath = path.join('node_modules', moduleName);
  const destPath = path.join(destDir, 'node_modules', moduleName);
  
  if (fs.existsSync(srcPath)) {
    console.log(`Copying ${moduleName}...`);
    copyDirectory(srcPath, destPath);
  } else {
    console.warn(`Warning: Module ${moduleName} not found in node_modules`);
  }
}

function main() {
  console.log('Preparing Lambda deployment package...');
  
  // Clean up previous build
  if (fs.existsSync(LAMBDA_DIST_DIR)) {
    console.log('Cleaning up previous build...');
    fs.rmSync(LAMBDA_DIST_DIR, { recursive: true, force: true });
  }
  
  // Create lambda dist directory
  ensureDirectoryExists(LAMBDA_DIST_DIR);
  
  // Copy compiled JavaScript files
  console.log('Copying compiled JavaScript files...');
  copyDirectory('dist', LAMBDA_DIST_DIR);
  
  // Copy required node modules
  console.log('Copying required node modules...');
  for (const moduleName of REQUIRED_MODULES) {
    copyNodeModule(moduleName, LAMBDA_DIST_DIR);
  }
  
  // Copy package.json (minimal version)
  console.log('Creating package.json...');
  const packageJson = {
    name: 'insurance-quotation-lambda',
    version: '1.0.0',
    main: 'index.js',
    dependencies: {}
  };
  
  // Add dependencies that we copied
  for (const moduleName of REQUIRED_MODULES) {
    const srcPackageJsonPath = path.join('node_modules', moduleName, 'package.json');
    if (fs.existsSync(srcPackageJsonPath)) {
      const modulePackageJson = JSON.parse(fs.readFileSync(srcPackageJsonPath, 'utf8'));
      packageJson.dependencies[moduleName] = modulePackageJson.version;
    }
  }
  
  fs.writeFileSync(
    path.join(LAMBDA_DIST_DIR, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  console.log('✅ Lambda deployment package prepared successfully!');
  console.log(`📦 Package location: ${LAMBDA_DIST_DIR}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('❌ Error preparing Lambda deployment package:', error.message);
    process.exit(1);
  }
}

module.exports = { main };