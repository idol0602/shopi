# 📋 Cẩm Nang Kiểm Tra & Quản Trị Containers Trên VPS Shopi
## (Áp dụng cho máy chủ VPS: `221.121.3.136`)

> **Dự án:** Shopi - High-Performance C2C Marketplace Microservices  
> **Tài liệu:** Hướng dẫn vận hành, kiểm tra số lượng, xem log, bắt bệnh và xử lý sự cố containers  
> **Vị trí dự án trên VPS:** `/opt/shopi`

---

## Mục Lục
1. [Đăng Nhập Vào VPS](#1-đăng-nhập-vào-vps)
2. [Kiểm Tra Danh Sách & Số Lượng Containers](#2-kiểm-tra-danh-sách--số-lượng-containers)
3. [Xem Log Từng Container Chi Tiết](#3-xem-log-từng-container-chi-tiết)
4. [Kiểm Tra Trạng Thái Sức Khỏe (Health Check)](#4-kiểm-tra-trạng-thái-sức-khỏe-health-check)
5. [Giám Sát Mức Tiêu Thụ CPU & RAM](#5-giám-sát-mức-tiêu-thụ-cpu--ram)
6. [Các Thao Tác Vận Hành Thường Dùng](#6-các-thao-tác-vận-hành-thường-dùng)
7. [Kịch Bản Tự Động Kiểm Tra Nhanh 1-Chạm (`check-all.sh`)](#7-kịch-bản-tự-động-kiểm-tra-nhanh-1-chạm-check-allsh)

---

## 1. Đăng Nhập Vào VPS

Mở **Command Prompt (CMD)** hoặc **PowerShell** trên máy tính cá nhân và đăng nhập:

```cmd
ssh -i "C:\Users\Admin\.ssh\shopi_deploy" root@221.121.3.136
```
*(Hoặc dùng mật khẩu: `ssh root@221.121.3.136` rồi nhập mật khẩu `Nguyenqu@n0602`)*

Sau khi đăng nhập thành công, chuyển vào thư mục dự án:
```bash
cd /opt/shopi
```

> [!IMPORTANT]
> Tất cả các lệnh `docker compose ...` bắt buộc phải chạy trong thư mục `/opt/shopi` (nơi chứa file `docker-compose.yml`).

---

## 2. Kiểm Tra Danh Sách & Số Lượng Containers

### 2.1. Lệnh xem tổng thể trạng thái
```bash
docker compose ps
```

Nếu muốn hiển thị đẹp và đầy đủ theo bảng:
```bash
docker compose ps --format "table {{.Name}}\t{{.Service}}\t{{.Status}}\t{{.Ports}}"
```

### 2.2. Bảng Danh Sách 12 Containers Chuẩn Của Hệ Thống Shopi:
Hệ thống chạy đầy đủ khi có **đủ 12-14 containers** với trạng thái **`Up (healthy)`** hoặc **`Up`**:

| # | Container Name | Service Name | Port Mapping | Trạng thái chuẩn |
|---|---|---|---|---|
| **1** | `shopi-nginx` | `nginx` | `80:80`, `443:443` | `Up (healthy)` |
| **2** | `shopi-nextjs-frontend` | `nextjs-frontend` | `3000:3000` | `Up (healthy)` |
| **3** | `shopi-api-gateway` | `api-gateway` | `8080:8080` | `Up (healthy)` |
| **4** | `shopi-identity-service` | `identity-service` | `8083:8083`, `9093:9093` | `Up (healthy)` |
| **5** | `shopi-catalog-service` | `shop-catalog-service` | `8081:8081`, `9091:9091` | `Up (healthy)` |
| **6** | `shopi-order-payment-service`| `order-payment-service` | `8082:8082`, `9092:9092` | `Up (healthy)` |
| **7** | `shopi-postgres-identity-db`| `postgres-identity-db` | `5434:5432` | `Up (healthy)` |
| **8** | `shopi-postgres-catalog-db` | `postgres-catalog-db` | `5432:5432` | `Up (healthy)` |
| **9** | `shopi-postgres-order-db`   | `postgres-order-db`   | `5433:5432` | `Up (healthy)` |
| **10**| `shopi-redis`               | `redis`               | `6379:6379` | `Up (healthy)` |
| **11**| `shopi-prometheus`          | `prometheus`          | `9090:9090` | `Up` |
| **12**| `shopi-grafana`             | `grafana`             | `3001:3000` | `Up` |
| **13**| `shopi-redis-commander`     | `redis-commander`     | `8085:8081` | `Up` (Công cụ quản trị) |
| **14**| `shopi-pgadmin`             | `pgadmin`             | `5050:80`   | `Up` (Công cụ quản trị) |

### 2.3. Lệnh kiểm tra nhanh số lượng container đang chạy:
```bash
# Đếm số container đang hoạt động
docker compose ps --status running -q | wc -l
```
👉 *Kết quả mong đợi: `12` đến `14`.*

### 2.4. Kiểm tra xem có container nào bị lỗi/tắt ngẫu nhiên không:
```bash
docker compose ps -a --filter "status=exited"
```
👉 *Nếu không có dòng nào hiển thị: Hệ thống hoạt động hoàn hảo 100%.*  
👉 *Nếu có container hiện trạng thái `Exited (1)`: Container đó đang bị crash, cần xem log theo mục 3.*

---

## 3. Xem Log Từng Container Chi Tiết

### 3.1. Cú pháp cơ bản
- **Xem log theo thời gian thực (Live Stream - tự động cập nhật):**
  ```bash
  docker compose logs -f <service_name>
  ```
  *(Bấm `Ctrl + C` để thoát)*

- **Xem N dòng log gần nhất:**
  ```bash
  docker compose logs --tail 50 <service_name>
  ```

- **Xem log kèm mốc thời gian (Timestamp):**
  ```bash
  docker compose logs -t --tail 50 <service_name>
  ```

---

### 3.2. Lệnh xem log cho từng dịch vụ cụ thể:

#### 🟢 1. Xem log Ingress Nginx (Kiểm tra lưu lượng truy cập web & lỗi proxy):
```bash
# Xem trực tiếp các request người dùng gửi tới
docker compose logs -f nginx

# Xem 30 dòng log lỗi gần nhất của Nginx
docker compose logs --tail 30 nginx
```

#### 🟢 2. Xem log Frontend Next.js (Kiểm tra SSR & giao diện):
```bash
docker compose logs -f nextjs-frontend
```

#### 🟢 3. Xem log Edge API Gateway (REST <-> gRPC Router):
```bash
# Kiểm tra định tuyến API, JWT, Rate Limiter
docker compose logs -f api-gateway
```

#### 🟢 4. Xem log Identity Service (Đăng ký, Đăng nhập, OTP, Google OAuth):
```bash
# Xem mã OTP gửi qua Redis và log xác thực tài khoản
docker compose logs -f identity-service
```

#### 🟢 5. Xem log Shop Catalog Service (Sản phẩm, Trừ kho, Hoàn kho):
```bash
# Xem log trừ kho tức thì và phục hồi hàng tồn kho
docker compose logs -f shop-catalog-service
```

#### 🟢 6. Xem log Order Payment Service (Đơn hàng & VietQR SePay):
```bash
# Xem log tạo đơn PENDING_PAYMENT, webhook VietQR SePay
docker compose logs -f order-payment-service
```

#### 🟢 7. Xem log Cơ sở dữ liệu (PostgreSQL & Redis):
```bash
# Xem log Redis Cache
docker compose logs -f redis

# Xem log Database Đơn hàng
docker compose logs -f postgres-order-db

# Xem log Database Sản phẩm
docker compose logs -f postgres-catalog-db

# Xem log Database Tài khoản
docker compose logs -f postgres-identity-db
```

---

## 4. Kiểm Tra Trạng Thái Sức Khỏe (Health Check)

### 4.1. Kiểm tra trực tiếp qua HTTP / Terminal
Chạy các lệnh `curl` sau trên VPS để kiểm tra từng tầng dịch vụ:

```bash
# 1. Kiểm tra Nginx Ingress (Trả về "OK\n", HTTP 200)
curl -i http://localhost/health

# 2. Kiểm tra Next.js Frontend (Trả về {"status":"UP","service":"shopi-frontend"})
curl -i http://localhost:3000/api/health

# 3. Kiểm tra API Gateway Actuator
curl -s http://localhost:8080/actuator/health | jq . || curl http://localhost:8080/actuator/health

# 4. Kiểm tra Identity Service
curl -s http://localhost:8083/actuator/health

# 5. Kiểm tra Catalog Service
curl -s http://localhost:8081/actuator/health

# 6. Kiểm tra Order Service
curl -s http://localhost:8082/actuator/health

# 7. Kiểm tra Redis (Trả về PONG)
docker exec -it shopi-redis redis-cli ping

# 8. Kiểm tra PostgreSQL Catalog DB (Trả về accepting connections)
docker exec -it shopi-postgres-catalog-db pg_isready -U shopi_catalog_user -d shopi_catalog_db
```

### 4.2. Bắt bệnh khi một container báo `(unhealthy)`
Nếu `docker compose ps` báo container nào đó `unhealthy`, hãy chạy lệnh sau để xem chính xác lý do kiểm tra sức khỏe bị thất bại:

```bash
# Xem kết quả chi tiết của lần healthcheck gần nhất
docker inspect --format='{{json .State.Health}}' <container_name> | jq .
```
*Ví dụ:*
```bash
docker inspect --format='{{json .State.Health}}' shopi-api-gateway | jq .
```

---

## 5. Giám Sát Mức Tiêu Thụ CPU & RAM

Với máy chủ 2GB RAM vật lý + 2GB Swap:

### 5.1. Xem tài nguyên tiêu thụ của TỪNG CONTAINER theo thời gian thực:
```bash
docker stats
```
*(Bấm `Ctrl + C` để thoát)*

Bảng hiển thị gồm:
- **`NAME`**: Tên container
- **`CPU %`**: Phần trăm CPU đang dùng
- **`MEM USAGE / LIMIT`**: RAM thực tế đang dùng / Hạn mức
- **`MEM %`**: Tỷ lệ RAM chiếm dụng

### 5.2. Chụp một lần (không stream):
```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

### 5.3. Xem tình trạng RAM vật lý & Swap toàn VPS:
```bash
free -h
```
👉 *Kiểm tra dòng `Swap:` xem có hiển thị `total 2.0Gi` không.*

### 5.4. Xem bảng quản trị htop (CPU, Threads, RAM):
```bash
htop
```
*(Bấm `q` hoặc `F10` để thoát)*

---

## 6. Các Thao Tác Vận Hành Thường Dùng

### 6.1. Khởi động lại riêng 1 container (không ảnh hưởng dịch vụ khác):
Ví dụ khi cập nhật cấu hình Nginx hoặc khởi động lại API Gateway:
```bash
# Khởi động lại Nginx
docker compose restart nginx

# Khởi động lại API Gateway
docker compose restart api-gateway
```

### 6.2. Nạp lại cấu hình Nginx không ngắt kết nối (Zero-Downtime Reload):
```bash
docker compose exec nginx nginx -s reload
```

### 6.3. Truy cập vào bên trong một Container (Terminal Shell):
Khi bạn muốn vào trong container để kiểm tra file hoặc gỡ lỗi:
```bash
# Vào container Nginx (Alpine Linux)
docker compose exec nginx sh

# Vào container Next.js Frontend
docker compose exec nextjs-frontend sh

# Vào container PostgreSQL để gõ lệnh psql
docker exec -it shopi-postgres-catalog-db psql -U shopi_catalog_user -d shopi_catalog_db
```
*(Gõ `exit` để thoát ra ngoài VPS).*

### 6.4. Dọn dẹp an toàn ổ đĩa (Giải phóng dung lượng SSD 20GB):
```bash
# Dọn dẹp image dangling và cache build mà TUYỆT ĐỐI KHÔNG XÓA DỮ LIỆU DATABASE
docker image prune -f
docker builder prune -f
```

> [!CAUTION]
> **CẢNH BÁO NGUY HIỂM:**  
> Tuyệt đối **KHÔNG BAO GIỜ** chạy lệnh:  
> ❌ `docker compose down -v`  
> Cờ `-v` sẽ xóa sạch vĩnh viễn toàn bộ cơ sở dữ liệu PostgreSQL và Redis.  
> Khi cần tắt hệ thống, chỉ dùng:  
> ✅ `docker compose down`

---

## 7. Kịch Bản Tự Động Kiểm Tra Nhanh 1-Chạm (`check-all.sh`)

Để bạn không cần phải gõ từng lệnh thủ công mỗi lần vào VPS, hãy tạo script kiểm tra tự động dưới đây:

### Bước 1: Tạo tệp script trên VPS
Chạy lệnh sau trên VPS (tại `/opt/shopi`):

```bash
cat << 'EOF' > /opt/shopi/check-all.sh
#!/bin/bash
# ==============================================================================
# SHOPI MARKETPLACE - ALL-IN-ONE SYSTEM DIAGNOSTIC SCRIPT
# ==============================================================================

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
GRAY='\033[0;90m'
NC='\033[0m'

echo -e "${CYAN}========================================================================${NC}"
echo -e "${GREEN}        SHOPI C2C MARKETPLACE - HỆ THỐNG KIỂM TRA SỨC KHỎE TỰ ĐỘNG      ${NC}"
echo -e "${CYAN}========================================================================${NC}"
echo -e "Thời gian kiểm tra: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo -e "${YELLOW}>>> 1. KIỂM TRA TÀI NGUYÊN MÁY CHỦ (RAM & SWAP):${NC}"
free -h | awk 'NR==1{print "       " $0} NR>1{print "  " $0}'
echo ""

echo -e "${YELLOW}>>> 2. KIỂM TRA SỐ LƯỢNG VÀ TRẠNG THÁI CONTAINERS:${NC}"
TOTAL=$(docker compose -f /opt/shopi/docker-compose.yml ps -q 2>/dev/null | wc -l)
RUNNING=$(docker compose -f /opt/shopi/docker-compose.yml ps --status running -q 2>/dev/null | wc -l)
HEALTHY=$(docker compose -f /opt/shopi/docker-compose.yml ps --format '{{.Status}}' 2>/dev/null | grep -c "(healthy)")

echo -e "  - Tổng số containers:    ${CYAN}${TOTAL}${NC}"
echo -e "  - Đang chạy (Running):   ${GREEN}${RUNNING}${NC}"
echo -e "  - Đạt chuẩn (Healthy):   ${GREEN}${HEALTHY}${NC}"

if [ "$RUNNING" -ge 12 ]; then
    echo -e "  --> ${GREEN}✅ ĐỦ SỐ LƯỢNG CONTAINERS CHUẨN (${RUNNING}/12+)${NC}"
else
    echo -e "  --> ${RED}⚠️ CẢNH BÁO: CHỈ CÓ ${RUNNING} CONTAINERS ĐANG CHẠY!${NC}"
fi
echo ""

echo -e "${YELLOW}>>> 3. CHI TIẾT TRẠNG THÁI CÁC DỊCH VỤ:${NC}"
docker compose -f /opt/shopi/docker-compose.yml ps --format "table   {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo -e "${YELLOW}>>> 4. KIỂM TRA HEALTH CHECK ENDPOINTS:${NC}"

check_endpoint() {
    local name="$1"
    local url="$2"
    local status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    if [ "$status" = "200" ]; then
        echo -e "  [200 OK]  ${GREEN}✅ ${name}${NC} (${GRAY}${url}${NC})"
    else
        echo -e "  [${status}]  ${RED}❌ ${name}${NC} (${GRAY}${url}${NC})"
    fi
}

check_endpoint "Nginx Ingress (Port 80)     " "http://localhost/health"
check_endpoint "Next.js Frontend (Port 3000) " "http://localhost:3000/api/health"
check_endpoint "Edge API Gateway (Port 8080) " "http://localhost:8080/actuator/health"
check_endpoint "Catalog Service (Port 8081)  " "http://localhost:8081/actuator/health"
check_endpoint "Order Service (Port 8082)    " "http://localhost:8082/actuator/health"
check_endpoint "Identity Service (Port 8083) " "http://localhost:8083/actuator/health"

REDIS_PING=$(docker exec shopi-redis redis-cli ping 2>/dev/null)
if [ "$REDIS_PING" = "PONG" ]; then
    echo -e "  [PONG]    ${GREEN}✅ Redis Cache (Port 6379)${NC}"
else
    echo -e "  [FAIL]    ${RED}❌ Redis Cache${NC}"
fi

echo ""
echo -e "${YELLOW}>>> 5. TIÊU THỤ RAM TỪNG CONTAINER:${NC}"
docker stats --no-stream --format "table   {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
echo ""
echo -e "${CYAN}========================================================================${NC}"
echo -e "${GREEN} Hoàn tất kiểm tra! Website: http://221.121.3.136${NC}"
echo -e "${CYAN}========================================================================${NC}"
EOF

chmod +x /opt/shopi/check-all.sh
```

### Bước 2: Chạy kiểm tra bất cứ lúc nào
Chỉ cần gõ:
```bash
/opt/shopi/check-all.sh
```
Hệ thống sẽ quét tức thì toàn bộ 12 containers, báo cáo trạng thái màu sắc trực quan, kiểm tra từng endpoint HTTP 200 và đo lường lượng RAM đang sử dụng chỉ trong 2 giây!
