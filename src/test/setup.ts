// Test setup and configuration
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test configuration
beforeAll(() => {
  // Setup test database connections, mock services, etc.
  console.log('Setting up test environment...');
});

afterAll(() => {
  // Cleanup test resources
  console.log('Cleaning up test environment...');
});

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};