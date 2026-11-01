-- Migration: Add Seller Payment Configs & Chat Tables
CREATE TABLE IF NOT EXISTS seller_payment_configs (
    id UUID PRIMARY KEY,
    seller_id UUID UNIQUE NOT NULL,
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    account_holder VARCHAR(100),
    sepay_api_key VARCHAR(255),
    sepay_webhook_token VARCHAR(255),
    test_mode BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_payment_seller_id ON seller_payment_configs(seller_id);

-- Seed default SePay test config for seller@shopi.vn (b0000000-0000-0000-0000-000000000002)
INSERT INTO seller_payment_configs (id, seller_id, bank_name, account_number, account_holder, sepay_api_key, sepay_webhook_token, test_mode, created_at, updated_at)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'MBBank',
    '0988776655',
    'NGUYEN MINH KHANG',
    'SEPAY_DEMO_KEY_2026',
    'SEPAY_DEMO_TOKEN_2026',
    true,
    NOW(), NOW()
) ON CONFLICT (seller_id) DO UPDATE
SET bank_name = EXCLUDED.bank_name,
    account_number = EXCLUDED.account_number,
    account_holder = EXCLUDED.account_holder,
    test_mode = EXCLUDED.test_mode,
    updated_at = NOW();

-- Alter orders table to record snapshot of seller bank details at checkout
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bank_account_holder VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100);

-- Chat System: Conversations & Messages
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY,
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    product_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_conversation_buyer_seller_product UNIQUE (buyer_id, seller_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_product ON conversations(product_id);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    content TEXT,
    image_url VARCHAR(500),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
