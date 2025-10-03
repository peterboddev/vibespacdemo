"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
exports.query = query;
exports.transaction = transaction;
exports.healthCheck = healthCheck;
const pg_1 = require("pg");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
let pool = null;
let secretsClient = null;
async function getDatabaseCredentials() {
    if (!secretsClient) {
        secretsClient = new client_secrets_manager_1.SecretsManagerClient({ region: process.env['AWS_REGION'] || 'us-east-1' });
    }
    const secretArn = process.env['DB_SECRET_ARN'];
    if (!secretArn) {
        throw new Error('DB_SECRET_ARN environment variable is required');
    }
    try {
        const command = new client_secrets_manager_1.GetSecretValueCommand({ SecretId: secretArn });
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
    }
    catch (error) {
        console.error('Failed to retrieve database credentials:', error);
        throw new Error('Failed to retrieve database credentials');
    }
}
function createDatabaseConfig(credentials) {
    return {
        host: credentials.host,
        port: credentials.port,
        database: credentials.dbname,
        user: credentials.username,
        password: credentials.password,
        ssl: process.env['NODE_ENV'] === 'production',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };
}
async function getDatabase() {
    if (!pool) {
        try {
            const credentials = await getDatabaseCredentials();
            const config = createDatabaseConfig(credentials);
            pool = new pg_1.Pool(config);
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            console.log('Database connection pool created successfully');
        }
        catch (error) {
            console.error('Failed to create database connection pool:', error);
            throw error;
        }
    }
    return pool;
}
async function closeDatabase() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('Database connection pool closed');
    }
}
async function query(text, params) {
    const db = await getDatabase();
    const client = await db.connect();
    try {
        const result = await client.query(text, params);
        return result;
    }
    finally {
        client.release();
    }
}
async function transaction(queries) {
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
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function healthCheck() {
    try {
        const result = await query('SELECT 1 as health_check');
        return result.rows.length > 0 && result.rows[0].health_check === 1;
    }
    catch (error) {
        console.error('Database health check failed:', error);
        return false;
    }
}
