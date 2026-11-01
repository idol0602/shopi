CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(250) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    price_amount BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    category VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    quantity INT NOT NULL DEFAULT 1,
    seller_id UUID NOT NULL,
    reserved_by_user_id UUID,
    locked_order_id UUID,
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_images (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    PRIMARY KEY (product_id, image_url)
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Seed Initial Marketplace Products for Demo Seller (b0000000-0000-0000-0000-000000000002)
INSERT INTO products (id, title, slug, description, price_amount, currency, category, status, quantity, seller_id, created_at, updated_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 
     'MacBook Pro 16 inch M1 Max 32GB RAM 1TB SSD Space Gray', 
     'macbook-pro-16-m1-max-32gb-1tb', 
     'Máy nguyên bản 99% dùng kỹ văn phòng, pin còn 94%, fullbox cáp sạc MagSafe chính hãng Apple.', 
     38500000, 
     'VND', 
     'DoDienTu', 
     'AVAILABLE', 
     1,
     'b0000000-0000-0000-0000-000000000002', 
     NOW(), NOW()),

    ('22222222-2222-2222-2222-222222222222', 
     'Máy ảnh Sony Alpha 7 IV (A7M4) Body chính hãng Sony VN', 
     'sony-alpha-7-iv-body-chinh-hang', 
     'Chụp tầm 4k shot, hoạt động hoàn hảo, cảm biến sạch bong không một vết xước.', 
     44500000, 
     'VND', 
     'MayAnh', 
     'AVAILABLE', 
     1,
     'b0000000-0000-0000-0000-000000000002', 
     NOW(), NOW()),

    ('33333333-3333-3333-3333-333333333333', 
     'Ghế công thái học Herman Miller Aeron Size B Mineral', 
     'herman-miller-aeron-size-b-mineral', 
     'Bản full option chân nhôm đánh bóng, lưới Pellicle thoáng khí, bệ tì tay da cao cấp.', 
     26500000, 
     'VND', 
     'NoiThat', 
     'AVAILABLE', 
     2,
     'b0000000-0000-0000-0000-000000000002', 
     NOW(), NOW()),

    ('44444444-4444-4444-4444-444444444444',
     'iPhone 15 Pro Max 256GB Titan Tự Nhiên VN/A Fullbox',
     'iphone-15-pro-max-256gb-titan-tu-nhien',
     'Máy mới active 3 tháng, pin 100%, bảo hành chính hãng Apple Việt Nam đến 2027.',
     27900000,
     'VND',
     'DoDienTu',
     'AVAILABLE',
     1,
     'b0000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    ('55555555-5555-5555-5555-555555555555',
     'Tai nghe Sony WH-1000XM5 Chống Ồn Chủ Động Màu Đen',
     'tai-nghe-sony-wh-1000xm5-chong-on-chu-dong',
     'Âm thanh đỉnh cao, pin 30 tiếng, chống ồn ANC tốt nhất phân khúc, kèm hộp đựng và dây cáp zin.',
     6800000,
     'VND',
     'DoDienTu',
     'AVAILABLE',
     3,
     'b0000000-0000-0000-0000-000000000002',
     NOW(), NOW())
ON CONFLICT (slug) DO UPDATE
SET quantity = EXCLUDED.quantity,
    status = EXCLUDED.status,
    price_amount = EXCLUDED.price_amount,
    updated_at = NOW();

INSERT INTO product_images (product_id, image_url)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80'),
    ('22222222-2222-2222-2222-222222222222', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80'),
    ('33333333-3333-3333-3333-333333333333', 'https://images.unsplash.com/photo-1580481077195-c328a37db729?w=800&q=80'),
    ('44444444-4444-4444-4444-444444444444', 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800&q=80'),
    ('55555555-5555-5555-5555-555555555555', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80')
ON CONFLICT (product_id, image_url) DO NOTHING;
