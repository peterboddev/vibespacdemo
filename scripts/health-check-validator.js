#!/usr/bin/env node

/**
 * Health Check Validator Script
 * 
 * This script validates the health of the deployed application by calling
 * the health check endpoint and verifying the response. It can be used
 * in CI/CD pipelines for automated rollback decisions.
 */

const https = require('https');
const http = require('http');

class HealthCheckValidator {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 5000; // 5 seconds
    this.timeout = options.timeout || 30000; // 30 seconds
    this.expectedStatus = options.expectedStatus || 'OK';
  }

  /**
   * Validate health check endpoint
   */
  async validateHealth(healthCheckUrl) {
    console.log(`Starting health check validation for: ${healthCheckUrl}`);
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${this.maxRetries}`);
        
        const result = await this.makeHealthCheckRequest(healthCheckUrl);
        
        if (this.isHealthy(result)) {
          console.log('✅ Health check passed');
          console.log('Health status:', JSON.stringify(result, null, 2));
          return { success: true, result };
        } else {
          console.log('❌ Health check failed');
          console.log('Health status:', JSON.stringify(result, null, 2));
          
          if (attempt < this.maxRetries) {
            console.log(`Waiting ${this.retryDelay}ms before retry...`);
            await this.sleep(this.retryDelay);
          }
        }
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          console.log(`Waiting ${this.retryDelay}ms before retry...`);
          await this.sleep(this.retryDelay);
        }
      }
    }
    
    console.log('❌ All health check attempts failed');
    return { success: false, error: 'Health check validation failed after all retries' };
  }

  /**
   * Make HTTP request to health check endpoint
   */
  makeHealthCheckRequest(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: this.timeout,
        headers: {
          'User-Agent': 'HealthCheckValidator/1.0',
          'Accept': 'application/json',
        },
      };

      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = {
              statusCode: res.statusCode,
              headers: res.headers,
              body: JSON.parse(data),
              timestamp: new Date().toISOString(),
            };
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      });

      req.end();
    });
  }

  /**
   * Check if the health check response indicates a healthy system
   */
  isHealthy(result) {
    // Check HTTP status code
    if (result.statusCode !== 200) {
      console.log(`❌ HTTP status code: ${result.statusCode} (expected: 200)`);
      return false;
    }

    // Check response body structure
    if (!result.body || typeof result.body !== 'object') {
      console.log('❌ Invalid response body structure');
      return false;
    }

    // Check overall status
    if (result.body.status !== this.expectedStatus) {
      console.log(`❌ Overall status: ${result.body.status} (expected: ${this.expectedStatus})`);
      return false;
    }

    // Check individual service health
    if (result.body.checks) {
      const failedChecks = [];
      
      for (const [service, check] of Object.entries(result.body.checks)) {
        if (check.status !== 'healthy') {
          failedChecks.push(`${service}: ${check.status}`);
        }
      }
      
      if (failedChecks.length > 0) {
        console.log(`❌ Failed service checks: ${failedChecks.join(', ')}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node health-check-validator.js <health-check-url> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --max-retries <number>     Maximum number of retry attempts (default: 3)');
    console.error('  --retry-delay <ms>         Delay between retries in milliseconds (default: 5000)');
    console.error('  --timeout <ms>             Request timeout in milliseconds (default: 30000)');
    console.error('  --expected-status <status> Expected health status (default: OK)');
    console.error('');
    console.error('Examples:');
    console.error('  node health-check-validator.js https://api.example.com/api/v1/health');
    console.error('  node health-check-validator.js https://api.example.com/api/v1/health --max-retries 5 --expected-status DEGRADED');
    process.exit(1);
  }

  const healthCheckUrl = args[0];
  const options = {};

  // Parse command line options
  for (let i = 1; i < args.length; i += 2) {
    const option = args[i];
    const value = args[i + 1];
    
    switch (option) {
      case '--max-retries':
        options.maxRetries = parseInt(value);
        break;
      case '--retry-delay':
        options.retryDelay = parseInt(value);
        break;
      case '--timeout':
        options.timeout = parseInt(value);
        break;
      case '--expected-status':
        options.expectedStatus = value;
        break;
      default:
        console.error(`Unknown option: ${option}`);
        process.exit(1);
    }
  }

  const validator = new HealthCheckValidator(options);
  
  try {
    const result = await validator.validateHealth(healthCheckUrl);
    
    if (result.success) {
      console.log('🎉 Health check validation completed successfully');
      process.exit(0);
    } else {
      console.error('💥 Health check validation failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Unexpected error during health check validation:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { HealthCheckValidator };