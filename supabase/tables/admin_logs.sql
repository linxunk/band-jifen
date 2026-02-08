CREATE TABLE admin_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);