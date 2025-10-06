import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DatabaseMetrics } from '../shared/metrics';

interface DatabaseCredentials {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
}

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

let pool: Pool | null = null;
let secretsClient: SecretsManagerClient | null = null;

/**
 * Get database credentials from AWS Secrets Manager
 */
async function getDatabaseCredentials(): Promise<DatabaseCredentials> {
  if (!secretsClient) {
    secretsClient = new SecretsManagerClient({ region: process.env['AWS_REGION'] || 'us-east-1' });
  }

  const secretArn = process.env['DB_SECRET_ARN'];
  if (!secretArn) {
    throw new Error('DB_SECRET_ARN environment variable is required');
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await secretsClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString);
    
    return {
      username: secret.username,
      password: secret.password,
      host: process.env['DB_CLUSTER_ENDPOINT'] || secret.host,
      port: parseInt(process.env['DB_PORT'] || '5432'),
      dbname: process.env['DB_NAME'] || 'insurance_quotation',
    };
  } catch (error) {
    console.error('Failed to retrieve database credentials:', error);
    throw new Error('Failed to retrieve database credentials');
  }
}

/**
 * Create database configuration from credentials
 */
function createDatabaseConfig(credentials: DatabaseCredentials): DatabaseConfig {
  return {
    host: credentials.host,
    port: credentials.port,
    database: credentials.dbname,
    user: credentials.username,
    password: credentials.password,
    ssl: process.env['NODE_ENV'] === 'production',
    max: 10, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 2000, // Timeout after 2 seconds
  };
}

/**
 * Get or create database connection pool
 */
export async function getDatabase(): Promise<Pool> {
  if (!pool) {
    try {
      const credentials = await getDatabaseCredentials();
      const config = createDatabaseConfig(credentials);
      
      pool = new Pool(config);
      
      // Test the connection
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      console.log('Database connection pool created successfully');
    } catch (error) {
      console.error('Failed to create database connection pool:', error);
      throw error;
    }
  }
  
  return pool;
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connection pool closed');
  }
}

/**
 * Execute a query with automatic connection management
 */
export async function query(text: string, params?: any[]): Promise<any> {
  const db = await getDatabase();
  const client = await db.connect();
  
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction(queries: Array<{ text: string; params?: any[] }>): Promise<any[]> {
  const db = await getDatabase();
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const results = [];
    for (const query of queries) {
      const result = await client.query(query.text, query.params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Health check for database connection with read/write test
 */
export async function healthCheck(): Promise<boolean> {
  try {
    // First, ensure we have a health check table
    await ensureHealthCheckTable();
    
    // Generate a unique test ID
    const testId = `health_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const testValue = Math.floor(Math.random() * 1000000);
    
    // Test write operation
    await query(
      'INSERT INTO health_check (test_id, test_value, created_at) VALUES ($1, $2, NOW())',
      [testId, testValue]
    );
    
    // Test read operation
    const readResult = await query(
      'SELECT test_value FROM health_check WHERE test_id = $1',
      [testId]
    );
    
    // Verify the data was written and read correctly
    const isHealthy = readResult.rows.length > 0 && 
                     readResult.rows[0].test_value === testValue;
    
    // Clean up test data
    await query('DELETE FROM health_check WHERE test_id = $1', [testId]);
    
    // Also clean up old health check records (older than 1 hour)
    await query('DELETE FROM health_check WHERE created_at < NOW() - INTERVAL \'1 hour\'');
    
    return isHealthy;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Detailed health check that returns more information about what was tested
 */
export async function detailedHealthCheck(): Promise<{
  healthy: boolean;
  operations: string[];
  operationLatencies: { [operation: string]: number };
  totalLatency: number;
  error?: string | undefined;
  testId?: string | undefined;
}> {
  const startTime = Date.now();
  const operations: string[] = [];
  const operationLatencies: { [operation: string]: number } = {};
  let testId: string | undefined;
  
  try {
    // Connection test
    let opStart = Date.now();
    operations.push('connection');
    operationLatencies['connection'] = Date.now() - opStart;
    
    // First, ensure we have a health check table
    opStart = Date.now();
    await ensureHealthCheckTable();
    operations.push('table_creation');
    operationLatencies['table_creation'] = Date.now() - opStart;
    
    // Generate a unique test ID
    testId = `health_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const testValue = Math.floor(Math.random() * 1000000);
    
    // Test write operation
    opStart = Date.now();
    await query(
      'INSERT INTO health_check (test_id, test_value, created_at) VALUES ($1, $2, NOW())',
      [testId, testValue]
    );
    operations.push('write');
    operationLatencies['write'] = Date.now() - opStart;
    
    // Test read operation
    opStart = Date.now();
    const readResult = await query(
      'SELECT test_value FROM health_check WHERE test_id = $1',
      [testId]
    );
    operations.push('read');
    operationLatencies['read'] = Date.now() - opStart;
    
    // Verify the data was written and read correctly
    const isHealthy = readResult.rows.length > 0 && 
                     readResult.rows[0].test_value === testValue;
    
    if (!isHealthy) {
      const totalLatency = Date.now() - startTime;
      
      // Record failed health check metrics
      await DatabaseMetrics.recordHealthCheck(totalLatency, operationLatencies, false);
      
      return {
        healthy: false,
        operations,
        operationLatencies,
        totalLatency,
        error: 'Data integrity check failed - written and read values do not match',
        testId
      };
    }
    
    // Clean up test data
    opStart = Date.now();
    await query('DELETE FROM health_check WHERE test_id = $1', [testId]);
    operations.push('cleanup');
    operationLatencies['cleanup'] = Date.now() - opStart;
    
    // Also clean up old health check records (older than 1 hour)
    opStart = Date.now();
    await query('DELETE FROM health_check WHERE created_at < NOW() - INTERVAL \'1 hour\'');
    operations.push('maintenance');
    operationLatencies['maintenance'] = Date.now() - opStart;
    
    const totalLatency = Date.now() - startTime;
    
    // Record successful health check metrics
    await DatabaseMetrics.recordHealthCheck(totalLatency, operationLatencies, true);
    
    return {
      healthy: true,
      operations,
      operationLatencies,
      totalLatency,
      testId
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    const totalLatency = Date.now() - startTime;
    
    // Record failed health check metrics
    await DatabaseMetrics.recordHealthCheck(totalLatency, operationLatencies, false);
    
    return {
      healthy: false,
      operations,
      operationLatencies,
      totalLatency,
      error: error instanceof Error ? error.message : 'Unknown database error',
      testId
    };
  }
}

/**
 * Ensure the health check table exists
 */
async function ensureHealthCheckTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS health_check (
        id SERIAL PRIMARY KEY,
        test_id VARCHAR(50) UNIQUE NOT NULL,
        test_value INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create index for efficient cleanup
    await query(`
      CREATE INDEX IF NOT EXISTS idx_health_check_created_at 
      ON health_check (created_at)
    `);
  } catch (error) {
    console.error('Failed to ensure health check table exists:', error);
    throw error;
  }
}