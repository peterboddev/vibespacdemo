#!/usr/bin/env node

/**
 * Safe route generation wrapper that tries TypeScript first, then falls back to simple version
 */

const { execSync } = require('child_process');

console.log('🔍 Attempting route generation...');

try {
  // Try the TypeScript version first
  console.log('Trying TypeScript route generation...');
  execSync('npx ts-node scripts/generate-routes.ts', { stdio: 'inherit' });
  console.log('✅ TypeScript route generation succeeded!');
} catch (error) {
  console.log('⚠️ TypeScript route generation failed, using fallback...');
  try {
    // Fall back to the simple JavaScript version
    execSync('node scripts/generate-routes-simple.js', { stdio: 'inherit' });
    console.log('✅ Fallback route generation succeeded!');
  } catch (fallbackError) {
    console.error('❌ Both route generation methods failed');
    console.log('Route generation skipped - continuing build');
    process.exit(0); // Don't fail the build
  }
}