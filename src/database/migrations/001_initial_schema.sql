-- Initial database schema for Insurance Quotation System
-- This migration creates the core tables needed for the application

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('customer', 'agent', 'admin');
CREATE TYPE insurance_type AS ENUM ('auto', 'home', 'life', 'health', 'business');
CREATE TYPE quote_status AS ENUM ('draft', 'active', 'expired', 'converted', 'declined');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Insurance products table
CREATE TABLE insurance_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type insurance_type NOT NULL,
    description TEXT,
    base_premium DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Quotes table
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES users(id),
    product_id UUID REFERENCES insurance_products(id),
    status quote_status DEFAULT 'draft',
    
    -- Personal information (JSON for flexibility)
    personal_info JSONB NOT NULL,
    
    -- Coverage details
    coverage_details JSONB NOT NULL,
    
    -- Risk assessment
    risk_score DECIMAL(5,2),
    risk_factors JSONB,
    
    -- Premium calculation
    base_premium DECIMAL(10,2) NOT NULL,
    adjustments DECIMAL(10,2) DEFAULT 0,
    discounts DECIMAL(10,2) DEFAULT 0,
    final_premium DECIMAL(10,2) NOT NULL,
    premium_breakdown JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Pricing rules table
CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES insurance_products(id),
    name VARCHAR(255) NOT NULL,
    condition_expression TEXT NOT NULL,
    adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('percentage', 'fixed')),
    adjustment_value DECIMAL(10,2) NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_quotes_reference_number ON quotes(reference_number);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_expires_at ON quotes(expires_at);
CREATE INDEX idx_quotes_created_at ON quotes(created_at);
CREATE INDEX idx_pricing_rules_product_id ON pricing_rules(product_id);
CREATE INDEX idx_pricing_rules_active ON pricing_rules(is_active);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_changed_at ON audit_logs(changed_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insurance_products_updated_at BEFORE UPDATE ON insurance_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON pricing_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for development
INSERT INTO insurance_products (name, type, description, base_premium) VALUES
('Basic Auto Insurance', 'auto', 'Basic coverage for personal vehicles', 500.00),
('Comprehensive Auto Insurance', 'auto', 'Full coverage including collision and comprehensive', 1200.00),
('Homeowners Insurance', 'home', 'Standard homeowners coverage', 800.00),
('Term Life Insurance', 'life', '20-year term life insurance', 300.00),
('Health Insurance Basic', 'health', 'Basic health coverage plan', 2400.00);

-- Insert sample pricing rules
INSERT INTO pricing_rules (product_id, name, condition_expression, adjustment_type, adjustment_value, priority) 
SELECT 
    id,
    'Young Driver Surcharge',
    'age < 25',
    'percentage',
    25.00,
    1
FROM insurance_products WHERE type = 'auto' LIMIT 1;

INSERT INTO pricing_rules (product_id, name, condition_expression, adjustment_type, adjustment_value, priority)
SELECT 
    id,
    'Multi-Policy Discount',
    'has_multiple_policies = true',
    'percentage',
    -10.00,
    2
FROM insurance_products WHERE type = 'auto' LIMIT 1;