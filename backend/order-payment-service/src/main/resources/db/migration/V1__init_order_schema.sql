-- Shopi Order and Payment Schema Initial Migration
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL,
    buyer_id VARCHAR(64) NOT NULL,
    seller_id VARCHAR(64) NOT NULL,
    total_amount BIGINT NOT NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'VND',
    status VARCHAR(32) NOT NULL,
    viet_qr_payload TEXT,
    receipt_image_url VARCHAR(1024),
    payment_deadline_epoch_ms BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
