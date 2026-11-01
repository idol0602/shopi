# Database Design & Architecture Specification

> **Project**: Shopi C2C Used-Goods Marketplace  
> **Pattern**: Database-per-Service + Direct Inventory Deduction (Atomic Saga) + Redis Multi-Level Caching  
> **Database Engines**: PostgreSQL 16 Alpine, Redis 7 Alpine  
> **Status**: Production Specification  

---

## 1. Executive Summary & Design Principles

Shopi implements the **Database-per-Service** architectural pattern. Each autonomous microservice owns its private relational database schema and multi-level cache. Cross-database queries or foreign keys between microservice boundaries are strictly forbidden to enforce loose coupling, independent scalability, and localized failure domains.

### Key Architectural Tenets:
1. **Zero Shared Storage**: Microservices never connect to another service's database directly. Inter-service data queries and transactions are negotiated through binary **gRPC (HTTP/2 Protobuf)**.
2. **UUID Primary Keys (RFC 4122 v4)**: All primary keys use 128-bit Universally Unique Identifiers (UUID) generated on the application layer to avoid sequential enumeration attacks and facilitate distributed shard rebalancing.
3. **Direct Inventory Deduction (No Holding Lock)**: Inventory quantity is decremented atomically at checkout time (`UPDATE products SET quantity = quantity - 1, status = CASE WHEN (quantity - 1) <= 0 THEN 'OUT_OF_STOCK' ELSE 'AVAILABLE' END WHERE id = :id AND quantity > 0`). If an order expires or is cancelled, compensation automatically restores quantity (`UPDATE products SET quantity = quantity + 1, status = 'AVAILABLE' WHERE id = :id`).
4. **Saga Distributed Transactions**: Cross-service transactional consistency is achieved via orchestrated Saga state machines with automated compensation rollbacks.
5. **Multi-Level Redis Fast-Path**: Ephemeral authentication tokens, token family tracking, rate-limiting counters, and reservation timeouts reside in Redis 7 with sub-millisecond access and automated TTL expiration.

---

## 2. Multi-Service Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    %% ==========================================
    %% DATABASE: shopi_identity_db
    %% ==========================================
    USERS {
        uuid id PK "RFC 4122 v4 UUID"
        varchar email UK "User login email (max 100)"
        varchar password_hash "BCrypt (cost factor 10-12) hash"
        varchar full_name "User display name (max 100)"
        varchar role "BUYER, SELLER, ADMIN (max 20)"
        boolean active "Account status flag (default true)"
        timestamptz created_at "Registration timestamp (UTC)"
        timestamptz updated_at "Profile last modified (UTC)"
    }

    %% ==========================================
    %% DATABASE: shopi_catalog_db
    %% ==========================================
    PRODUCTS {
        uuid id PK "RFC 4122 v4 UUID"
        varchar title "Product title (max 200)"
        varchar slug UK "SEO unique slug (max 250)"
        text description "Detailed markdown/text description"
        bigint price_amount "Unit price in VND (no floating point)"
        varchar currency "ISO 4217 Currency (default 'VND')"
        varchar category "Category slug/id (max 100)"
        int quantity "Available stock quantity (default 1)"
        varchar status "AVAILABLE, RESERVED, SOLD, HIDDEN, OUT_OF_STOCK"
        uuid seller_id "Cross-service reference to USERS.id"
        uuid reserved_by_user_id "Buyer holding temporary checkout"
        uuid locked_order_id "Order holding temporary lock"
        timestamptz locked_at "Timestamp when checkout initiated"
        timestamptz created_at "Product publish time (UTC)"
        timestamptz updated_at "Product last modified (UTC)"
    }

    PRODUCT_IMAGES {
        uuid product_id FK "References PRODUCTS.id (Cascade)"
        varchar image_url "CDN/S3 secure image URL (max 500)"
    }

    PRODUCTS ||--o{ PRODUCT_IMAGES : "has 1..N images"

    %% ==========================================
    %% DATABASE: shopi_order_db
    %% ==========================================
    ORDERS {
        uuid id PK "RFC 4122 v4 UUID"
        varchar product_id "Cross-service reference to PRODUCTS.id"
        varchar buyer_id "Cross-service reference to USERS.id"
        varchar seller_id "Cross-service reference to USERS.id"
        bigint total_amount "Order total in VND"
        varchar currency "Currency code ('VND')"
        varchar status "PENDING_PAYMENT, PROOF_UPLOADED, CONFIRMED, SHIPPED, CANCELLED, PAYMENT_FAILED"
        text viet_qr_payload "Dynamic VietQR transfer payload URL"
        varchar receipt_image_url "Uploaded payment receipt proof URL"
        varchar bank_name "Seller bank snapshot at checkout"
        varchar bank_account_number "Seller bank account number snapshot"
        varchar bank_account_holder "Seller bank account holder snapshot"
        bigint payment_deadline_epoch_ms "15-minute countdown deadline (epoch ms)"
        bigint created_at "Order initiation epoch ms"
        bigint updated_at "Order status update epoch ms"
    }

    SELLER_PAYMENT_CONFIGS {
        uuid id PK "RFC 4122 v4 UUID"
        uuid seller_id UK "Unique reference to USERS.id"
        varchar bank_name "Bank code/name (e.g. MBBank)"
        varchar account_number "Bank account number"
        varchar account_holder "Full account holder name"
        varchar sepay_api_key "Encrypted SePay API Key"
        varchar sepay_webhook_token "SePay Webhook Verification Token"
        boolean test_mode "Simulated instant confirmation flag"
        timestamptz created_at "Config creation timestamp"
        timestamptz updated_at "Config modification timestamp"
    }

    CONVERSATIONS {
        uuid id PK "RFC 4122 v4 UUID"
        uuid buyer_id "Cross-service reference to USERS.id"
        uuid seller_id "Cross-service reference to USERS.id"
        uuid product_id "Cross-service reference to PRODUCTS.id"
        timestamptz created_at "Conversation start timestamp"
        timestamptz updated_at "Last message activity timestamp"
    }

    MESSAGES {
        uuid id PK "RFC 4122 v4 UUID"
        uuid conversation_id FK "References CONVERSATIONS.id (Cascade)"
        uuid sender_id "Sender user UUID"
        text content "Message plain text content"
        varchar image_url "Optional uploaded image attachment URL"
        boolean is_read "Read receipt indicator flag"
        timestamptz created_at "Message dispatch timestamp"
    }

    CONVERSATIONS ||--o{ MESSAGES : "contains 0..N messages"

    %% ==========================================
    %% CROSS-SERVICE CONCEPTUAL RELATIONSHIPS
    %% (Negotiated over gRPC - No Physical FKs)
    %% ==========================================
    USERS ||..o{ PRODUCTS : "owns/sells (gRPC)"
    USERS ||..o{ ORDERS : "places as buyer / receives as seller (gRPC)"
    USERS ||..o| SELLER_PAYMENT_CONFIGS : "owns 1 config (gRPC)"
    PRODUCTS ||..o{ ORDERS : "item ordered (Atomic Saga)"
    PRODUCTS ||..o{ CONVERSATIONS : "context product for chat"
```

---

## 3. Physical Schema Specification

### 3.1 Database 1: `shopi_identity_db` (Port `5434` / Internal `5432`)
- **Owner Service**: `identity-service` (Spring Boot, gRPC Port 9093, HTTP Port 8083)
- **Primary Responsibility**: User credentials, identity claims, password security.

#### Table: `users`
| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY` | Unique identifier generated via `UUID.randomUUID()` |
| `email` | `VARCHAR(100)` | No | `UNIQUE` | Case-insensitive normalized email address |
| `password_hash` | `VARCHAR(255)` | No | | BCrypt hashed password with salt cost 10 |
| `full_name` | `VARCHAR(100)` | No | | Full customer display name |
| `role` | `VARCHAR(20)` | No | `DEFAULT 'BUYER'` | Enumeration: `'BUYER'`, `'SELLER'`, `'ADMIN'` |
| `active` | `BOOLEAN` | No | `DEFAULT TRUE` | Soft-disable flag for ban/moderation |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT NOW()` | Record modification timestamp |

#### Seed Accounts:
- Admin: `admin@shopi.vn` / `admin123` (`a0000000-0000-0000-0000-000000000001`)
- Seller: `seller@shopi.vn` / `seller123` (`b0000000-0000-0000-0000-000000000002`)
- Buyer: `buyer@shopi.vn` / `buyer123` (`c0000000-0000-0000-0000-000000000003`)

---

### 3.2 Database 2: `shopi_catalog_db` (Port `5432` / Internal `5432`)
- **Owner Service**: `shop-catalog-service` (Spring Boot, gRPC Port 9091, HTTP Port 8081)
- **Primary Responsibility**: C2C used-goods product listings, image metadata, atomic inventory deduction.

#### Table: `products`
| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY` | RFC 4122 v4 Product ID |
| `title` | `VARCHAR(200)` | No | | Product title / headline |
| `slug` | `VARCHAR(250)` | No | `UNIQUE` | URL-friendly slug for SEO routing |
| `description` | `TEXT` | No | | Full description including used condition notes |
| `price_amount` | `BIGINT` | No | | Integer price in VND |
| `currency` | `VARCHAR(10)` | No | `DEFAULT 'VND'` | ISO 4217 Currency symbol |
| `category` | `VARCHAR(100)` | No | | Category slug (`DoDienTu`, `MayAnh`, `NoiThat`) |
| `quantity` | `INT` | No | `DEFAULT 1` | Available stock count (decrements immediately on purchase) |
| `status` | `VARCHAR(30)` | No | `DEFAULT 'AVAILABLE'` | `'AVAILABLE'`, `'RESERVED'`, `'SOLD'`, `'HIDDEN'`, `'OUT_OF_STOCK'` |
| `seller_id` | `UUID` | No | | Identifier of seller in `identity-service` |
| `reserved_by_user_id` | `UUID` | Yes | `DEFAULT NULL` | Buyer holding checkout lock |
| `locked_order_id` | `UUID` | Yes | `DEFAULT NULL` | Order ID associated with checkout |
| `locked_at` | `TIMESTAMPTZ` | Yes | `DEFAULT NULL` | Timestamp when checkout was initiated |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT NOW()` | Publication timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT NOW()` | Last modification timestamp |

#### Table: `product_images`
| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- | :--- |
| `product_id` | `UUID` | No | `REFERENCES products(id) ON DELETE CASCADE` | Associated product |
| `image_url` | `VARCHAR(500)` | No | | HTTPS link to CDN or `/api/uploads/...` |

---

### 3.3 Database 3: `shopi_order_db` (Port `5433` / Internal `5432`)
- **Owner Service**: `order-payment-service` (Spring Boot, gRPC Port 9092, HTTP Port 8082)
- **Primary Responsibility**: Order lifecycle state machine, SePay webhook processing, seller bank accounts, buyer-seller chat.

#### Table: `orders`
| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY` | RFC 4122 v4 Order ID |
| `product_id` | `VARCHAR(64)` | No | | Product ID being purchased |
| `buyer_id` | `VARCHAR(64)` | No | | Buyer ID initiating purchase |
| `seller_id` | `VARCHAR(64)` | No | | Product owner receiving funds |
| `total_amount` | `BIGINT` | No | | Amount due in VND |
| `currency` | `VARCHAR(16)` | No | `DEFAULT 'VND'` | Currency denomination |
| `status` | `VARCHAR(32)` | No | | State machine status (Section 5) |
| `viet_qr_payload` | `TEXT` | Yes | | Pre-generated VietQR QuickLink with seller bank info |
| `receipt_image_url` | `VARCHAR(1024)` | Yes | | Buyer-uploaded payment proof screenshot |
| `bank_name` | `VARCHAR(100)` | Yes | | Seller bank name snapshot (e.g. MBBank) |
| `bank_account_number` | `VARCHAR(50)` | Yes | | Seller bank account number snapshot |
| `bank_account_holder` | `VARCHAR(100)` | Yes | | Seller account holder name snapshot |
| `payment_deadline_epoch_ms` | `BIGINT` | No | | Millisecond epoch limit ($T + 15\text{m}$) |
| `created_at` | `BIGINT` | No | | Millisecond epoch timestamp |
| `updated_at` | `BIGINT` | No | | Millisecond epoch timestamp |

#### Table: `seller_payment_configs`
| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY` | Unique config UUID |
| `seller_id` | `UUID` | No | `UNIQUE` | References seller in `identity-service` |
| `bank_name` | `VARCHAR(100)` | Yes | | Supported bank code (e.g. MBBank, VCB, ACB) |
| `account_number` | `VARCHAR(50)` | Yes | | Account number for VietQR generation |
| `account_holder` | `VARCHAR(100)` | Yes | | Account owner name |
| `sepay_api_key` | `VARCHAR(255)` | Yes | | SePay API integration key |
| `sepay_webhook_token` | `VARCHAR(255)` | Yes | | Verification secret for incoming webhooks |
| `test_mode` | `BOOLEAN` | No | `DEFAULT TRUE` | Allows `/api/orders/{id}/simulate-payment` |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT NOW()` | Modification timestamp |

#### Table: `conversations`
| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY` | Conversation UUID |
| `buyer_id` | `UUID` | No | | Buyer UUID |
| `seller_id` | `UUID` | No | | Seller UUID |
| `product_id` | `UUID` | No | | Inquired product UUID |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT NOW()` | Conversation initiation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT NOW()` | Last message timestamp |

#### Table: `messages`
| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY` | Message UUID |
| `conversation_id` | `UUID` | No | `REFERENCES conversations(id) ON DELETE CASCADE` | Associated chat thread |
| `sender_id` | `UUID` | No | | Author user UUID |
| `content` | `TEXT` | Yes | | Message text body |
| `image_url` | `VARCHAR(500)` | Yes | | Uploaded image path `/api/uploads/...` |
| `is_read` | `BOOLEAN` | No | `DEFAULT FALSE` | Read receipt flag |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT NOW()` | Sent timestamp |

---

## 4. Redis 7 Key Architecture

| Key Pattern | Redis Type | Default TTL | Owning Service | Purpose & Payload |
| :--- | :--- | :--- | :--- | :--- |
| `auth:refresh:<refreshToken>` | `STRING` | 14 days | `identity-service` | Active refresh token to user mapping: `<userId>` |
| `auth:blacklist:<jwtToken>` | `STRING` | 15 minutes | `api-gateway` / `identity-service` | Revoked access token blacklist: `"revoked"` |
| `order:timeout:<orderId>` | `STRING` | 15 minutes | `order-payment-service` | Active checkout timeout tracker: `<productId>` |
| `ratelimit:<clientKey>` | `STRING` | 60 seconds | `api-gateway` | Sliding token bucket rate limit counter (60 req/min) |

---

## 5. Direct Inventory Deduction & Saga Compensation Lifecycle

```
[AVAILABLE] (quantity = N)
     │
     ▼ (1) CreateOrder: Direct Atomic Inventory Decrement
     │   UPDATE products SET quantity = quantity - 1, 
     │   status = CASE WHEN quantity - 1 <= 0 THEN 'OUT_OF_STOCK' ELSE 'AVAILABLE' END
     │
[PENDING_PAYMENT] (Order created, VietQR displayed, 15m timer active)
     │
     ├─ (2a) SePay Webhook / Simulate Payment ──► [CONFIRMED] -> [SHIPPED]
     │       (Order confirmed, product marked SOLD if quantity = 0)
     │
     ├─ (2b) Buyer Uploads Receipt ────────────► [PROOF_UPLOADED] ──► Seller Confirm ──► [CONFIRMED]
     │
     └─ (2c) Cancel Order / 15m Timeout ──────► [CANCELLED]
             (Compensation Rollback: UPDATE products SET quantity = quantity + 1, status = 'AVAILABLE')
```
