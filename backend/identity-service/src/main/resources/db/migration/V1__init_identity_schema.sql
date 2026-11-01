CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'BUYER',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Seed default test accounts (admin@shopi.vn / seller@shopi.vn / buyer@shopi.vn)
INSERT INTO users (id, email, password_hash, full_name, role, active, created_at, updated_at)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'admin@shopi.vn', '$2a$10$iMEqay6mveySgMMBDdXDQecHYq1/sA0OQg8FICyDG6ima7oJHiyX.', 'Shopi System Admin', 'ADMIN', true, NOW(), NOW()),
    ('b0000000-0000-0000-0000-000000000002', 'seller@shopi.vn', '$2a$10$8vNfTCXUjYKtGbX6aR/y.uHq/QNuQ4xfirADy0Zrlhvl7CBQVOUqy', 'Shopi Verified Seller', 'SELLER', true, NOW(), NOW()),
    ('c0000000-0000-0000-0000-000000000003', 'buyer@shopi.vn', '$2a$10$7PejAyjhf23DZeosHLrU5O1OH3JFXH1vidfDoMpRNI0bNr9tExxV.', 'Shopi Prime Buyer', 'BUYER', true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    active = EXCLUDED.active,
    updated_at = NOW();
