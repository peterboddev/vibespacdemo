import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

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
 * Health check for database connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as health_check');
    return result.rows.length > 0 && result.rows[0].health_check === 1;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}