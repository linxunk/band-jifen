CREATE TABLE deposit_requests (
    id SERIAL PRIMARY KEY,
    card_number VARCHAR(32) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);