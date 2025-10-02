#!/usr/bin/env node

/**
 * Simple route generation script that doesn't require TypeScript compilation
 * This is a fallback for when the TypeScript version fails in CI/CD
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Simple route generation (JavaScript fallback)...');

try {
  // Create the generated directory
  const outputDir = 'infrastructure/generated';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create a simple routes configuration
  const config = {
    generatedAt: new Date().toISOString(),
    functions: [],
    routes: [],
    note: 'This is a fallback configuration. Dynamic route generation is disabled.'
  };

  const outputPath = path.join(outputDir, 'routes.json');
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
  
  console.log('✅ Simple routes configuration generated successfully!');
  console.log('📁 Output:', outputPath);
} catch (error) {
  console.error('❌ Failed to generate simple routes configuration:', error.message);
  process.exit(1);
}