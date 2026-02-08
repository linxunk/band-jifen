CREATE TABLE transfer_rules (
    id SERIAL PRIMARY KEY,
    card_number VARCHAR(32) NOT NULL,
    daily_deposit DECIMAL(15,2) DEFAULT 0.00,
    daily_deduction DECIMAL(15,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);