# 🚀 Hướng Dẫn CI/CD GitHub Actions & Triển Khai Lên VPS Shopi
## (Được Tùy Chỉnh Chính Xác Theo Cấu Hình VPS Thực Tế 221.121.3.136)

> **Dự án:** Shopi - High-Performance C2C Marketplace Microservices  
> **Địa chỉ VPS:** `221.121.3.136`  
> **Cập nhật:** Tháng 11/2026 (Phù hợp 100% với môi trường VPS đã setup)

---

## 1. Thông Tin Môi Trường VPS Thực Tế Của Bạn

Máy chủ VPS của bạn đã được thiết lập sẵn sàng với các thông số sau:

| Thông số | Giá trị thực tế trên VPS | Đánh giá & Tối ưu hóa của Shopi |
|---|---|---|
| **IP Public** | `221.121.3.136` | IP tĩnh kết nối từ GitHub Actions qua SSH |
| **Hệ điều hành** | Ubuntu 20.04.6 LTS x86_64 | Hỗ trợ hoàn hảo Docker Engine & Linux kernel 5.4+ |
| **RAM vật lý** | 2 GB | Đã tối ưu JVM `-Xmx256m` cho 4 Spring Boot services |
| **Swap Memory** | **2 GB Swap** (Tổng RAM ảo: **4 GB**) | ✅ **Đã tạo thành công**, ngăn ngừa OOM Killer |
| **Ổ cứng SSD** | 20 GB (Trống ~12 GB) | ✅ Đủ dung lượng vì Docker build chạy trên GitHub Actions |
| **Docker Engine** | `v28.1.1` (Active/Running) | ✅ Bản mới nhất, tự khởi động cùng hệ thống |
| **Docker Compose** | `v2.35.1` (Hỗ trợ cả 2 cú pháp) | ✅ Đầy đủ Compose V2 (`docker compose`) |
| **Tường lửa UFW** | Đã mở ports 22, 80, 443 | ✅ Sẵn sàng đón HTTP/HTTPS và SSH từ GitHub |
| **Thư mục dự án** | `/opt/shopi` (và `/root/projects`) | Nơi đồng bộ docker-compose và cấu hình Nginx/Prometheus |

> [!TIP]
> **Điểm ưu việt của kiến trúc CI/CD Shopi:**
> Toàn bộ quá trình biên dịch mã nguồn Java (`mvn test`), kiểm tra frontend (`npm run build`) và đóng gói Multi-Arch Docker images được **thực hiện 100% trên Cloud Runners của GitHub** (miễn phí, RAM 16GB, 4 vCPU).
> Máy chủ VPS `221.121.3.136` của bạn **chỉ kéo các images đã đóng gói về và khởi chạy**, do đó hoàn toàn không tốn CPU/RAM để build, hoạt động êm ái trên VPS 2GB RAM.

---

## 2. Trạng Thái Các Bước (Tiến Độ Thiết Lập)

- [x] **Bước 1:** Khắc phục gói APT và cài đặt tiện ích hệ thống (`curl`, `git`, `htop`, `ufw`, `zip`...)
- [x] **Bước 2:** Tạo và kích hoạt **2GB Swap Memory** (`vm.swappiness=10`)
- [x] **Bước 3:** Cài đặt Docker CE `v28.1.1` và Docker Compose Plugin `v2.35.1`
- [x] **Bước 4:** Mở cổng tường lửa UFW (22/SSH, 80/HTTP, 443/HTTPS)
- [x] **Bước 5:** Tối ưu hóa JVM trong `docker-compose.yml` (`JAVA_TOOL_OPTIONS=-Xms128m -Xmx256m`)
- [ ] **Bước 6:** Tạo cặp khóa SSH Key và đẩy Public Key lên VPS `root@221.121.3.136`
- [ ] **Bước 7:** Khai báo 3 GitHub Repository Secrets
- [ ] **Bước 8:** Bật quyền Workflow Permissions trên GitHub
- [ ] **Bước 9:** Push code lên nhánh `main` và theo dõi quá trình tự động triển khai

---

## 3. Các Bước Cần Làm Tiếp Theo Để Kích Hoạt CI/CD

Chỉ còn **3 bước cấu hình đơn giản** trên máy cá nhân và GitHub của bạn:

---

### BƯỚC 1: Tạo Khóa SSH & Cấp Quyền Đăng Nhập VPS Không Cần Password

GitHub Actions sẽ dùng khóa SSH Private Key để đăng nhập tự động vào VPS `221.121.3.136`.

#### 1.1. Mở PowerShell hoặc Terminal trên máy tính của bạn và chạy:

```powershell
# Tạo cặp khóa SSH Ed25519 chuyên dụng cho Shopi Deploy
ssh-keygen -t ed25519 -C "github-actions-shopi" -f "$HOME/.ssh/shopi_deploy"
```
*(Khi được hỏi `Enter passphrase`, bấm **Enter** 2 lần để không đặt mật khẩu cho key).*

Lệnh trên sẽ tạo ra 2 file trong thư mục `~/.ssh/`:
- `shopi_deploy` (Private Key - bí mật, sẽ dùng cho GitHub Secret)
- `shopi_deploy.pub` (Public Key - đưa lên VPS)

#### 1.2. Đưa Public Key lên VPS 221.121.3.136:

**Cách A: Dùng lệnh tự động (nếu có `ssh-copy-id` trên Mac/Linux/WSL):**
```bash
ssh-copy-id -i ~/.ssh/shopi_deploy.pub root@221.121.3.136
```
*(Nhập mật khẩu VPS: `Nguyenqu@n0602`)*

**Cách B: Dùng PowerShell trên Windows (Copy thủ công):**
1. Đọc nội dung Public Key trên máy bạn:
   ```powershell
   Get-Content "$HOME/.ssh/shopi_deploy.pub"
   ```
   *(Copy toàn bộ chuỗi ký tự hiển thị, bắt đầu bằng `ssh-ed25519 AAAAC3Nza...`)*

2. Đăng nhập vào VPS qua SSH:
   ```powershell
   ssh root@221.121.3.136
   ```
   *(Nhập mật khẩu: `Nguyenqu@n0602`)*

3. Dán Public Key vào file `authorized_keys` trên VPS:
   ```bash
   mkdir -p ~/.ssh && chmod 700 ~/.ssh
   echo "DAN_CHUOI_PUBLIC_KEY_VAO_DAY" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   exit
   ```

#### 1.3. Kiểm tra kết nối từ máy tính của bạn:
```powershell
ssh -i "$HOME/.ssh/shopi_deploy" root@221.121.3.136
```
👉 Nếu đăng nhập thành công thẳng vào VPS **mà không hỏi mật khẩu**, bạn đã hoàn thành Bước 1! Gõ `exit` để thoát.

---

### BƯỚC 2: Cấu Hình GitHub Secrets Trên Repository

1. Truy cập vào Repository dự án Shopi trên GitHub:  
   `https://github.com/<tai-khoan-cua-ban>/shopi`
2. Vào **Settings** (tab bánh răng ở góc trên) -> **Secrets and variables** -> **Actions**.
3. Nhấp vào nút xanh **New repository secret** để thêm lần lượt **3 Secrets** sau:

| Secret Name | Value cần nhập | Mô tả |
|---|---|---|
| `VPS_HOST` | `221.121.3.136` | Địa chỉ IP của máy chủ VPS |
| `VPS_USER` | `root` | Tên người dùng quản trị SSH |
| `SSH_PRIVATE_KEY` | *(Toàn bộ nội dung file `shopi_deploy`)* | Khóa bí mật dùng để xác thực SSH |

> [!IMPORTANT]
> **Cách lấy nội dung `SSH_PRIVATE_KEY`:**  
> Mở PowerShell trên máy cá nhân và chạy:
> ```powershell
> Get-Content "$HOME/.ssh/shopi_deploy" -Raw
> ```
> Copy **toàn bộ nội dung**, bao gồm cả dòng đầu `-----BEGIN OPENSSH PRIVATE KEY-----` và dòng cuối `-----END OPENSSH PRIVATE KEY-----`.

---

### BƯỚC 3: Cấp Quyền Workflow Cho GitHub Actions

Để GitHub Actions có quyền đẩy container images lên GitHub Container Registry (`ghcr.io`):

1. Trong trang cài đặt repository trên GitHub:  
   Vào **Settings** -> **Actions** -> **General**.
2. Cuộn xuống mục **Workflow permissions**:
   - Chọn: 🔘 **Read and write permissions**.
   - Tích chọn: ☑️ **Allow GitHub Actions to create and approve pull requests**.
3. Bấm **Save**.

---

## 4. Kích Hoạt CI/CD Pipeline

Sau khi hoàn thành 3 bước cấu hình trên, bạn chỉ cần đưa mã nguồn lên nhánh `main`:

```bash
# 1. Kiểm tra các file thay đổi
git status

# 2. Thêm toàn bộ các cập nhật
git add .

# 3. Commit
git commit -m "feat: complete shopi enterprise services, nginx fix, and ci-cd"

# 4. Push lên GitHub
git push origin main
```

Ngay sau khi lệnh push hoàn tất:
1. Vào tab **Actions** trên GitHub repository của bạn.
2. Bạn sẽ thấy workflow **Shopi Enterprise Production CI/CD Pipeline** bắt đầu chạy:
   - ⏱️ **Job 1 (Test):** Chạy kiểm thử song song 4 microservices backend (`api-gateway`, `identity`, `catalog`, `order`) và lint/build frontend.
   - ⏱️ **Job 2 (Build & Push):** Đóng gói 5 images và đẩy lên `ghcr.io`.
   - ⏱️ **Job 3 (Deploy):** Tự động kết nối SSH vào `221.121.3.136`, tải cấu hình vào `/opt/shopi/`, kéo images mới và khởi chạy toàn bộ 12 containers với rolling update không ngắt quãng dịch vụ!

---

## 5. Các Kịch Bản Vận Hành & Lệnh Quản Trị Trên VPS

Khi cần kiểm tra hoặc thao tác trực tiếp trên VPS `221.121.3.136`:

### 5.1. Đăng nhập nhanh vào VPS
```bash
ssh -i ~/.ssh/shopi_deploy root@221.121.3.136
```

### 5.2. Kiểm tra trạng thái toàn bộ containers
```bash
cd /opt/shopi
docker compose ps
```
*Kỳ vọng: Toàn bộ 12 containers (`nginx`, `frontend`, `api-gateway`, `catalog`, `identity`, `order`, 3 DBs postgres, `redis`, `prometheus`, `grafana`) đều ở trạng thái `Up (healthy)`.*

### 5.3. Xem log thời gian thực
```bash
# Xem log toàn bộ hệ thống
docker compose logs -f

# Xem log riêng API Gateway
docker compose logs -f api-gateway

# Xem log Nginx Ingress
docker compose logs -f nginx
```

### 5.4. Kiểm tra sức khỏe hệ thống (Health Check)
```bash
# Kiểm tra Ingress Nginx (trả về HTTP 200 OK)
curl -i http://localhost/health

# Kiểm tra API Gateway
curl -i http://localhost:8080/actuator/health

# Kiểm tra Identity Service
curl -i http://localhost:8083/actuator/health
```

---

## 6. Hướng Dẫn Chạy Redeploy Sạch Sẽ (Manual Trigger)

Khi bạn muốn xóa sạch các container images cũ, giải phóng dung lượng ổ đĩa, làm mới hoàn toàn nhưng **TUYỆT ĐỐI GIỮ LẠI DỮ LIỆU CƠ SỞ DỮ LIỆU (Named Volumes)**:

1. Vào GitHub repo -> Tab **Actions**.
2. Chọn workflow **Shopi Enterprise Production CI/CD Pipeline** ở cột bên trái.
3. Nhấp vào nút **Run workflow** (ở góc phải):
   - **Branch:** `main`
   - **Deployment action:** Chọn **`redeploy`**.
   - Bấm nút xanh **Run workflow**.

### Cơ chế bảo toàn dữ liệu của lệnh Redeploy:
Pipeline sẽ tự động thực thi chuỗi lệnh an toàn trên VPS:
```bash
# 1. Dừng containers nhưng KHÔNG dùng cờ -v -> TOÀN BỘ DỮ LIỆU ĐƯỢC GIỮ NGUYÊN
docker compose down

# 2. Xóa các image cũ của dự án để giải phóng ổ cứng SSD 20GB
docker compose config --images | xargs -r docker rmi -f 2>/dev/null || true
docker image prune -f && docker builder prune -f

# 3. Kéo bản build mới nhất từ GitHub Container Registry
docker compose pull

# 4. Khởi chạy lại toàn bộ dịch vụ với dữ liệu cũ
docker compose up -d

# 5. Kiểm tra health check tự động
```

---

## 7. Đường Dẫn Dịch Vụ Sau Khi Triển Khai

Sau khi deploy thành công, bạn có thể truy cập hệ thống qua IP của VPS:

- 🛒 **Trang chủ Cửa hàng Shopi:** `http://221.121.3.136` (qua Nginx Ingress port 80)
- 🔌 **API Gateway REST Documentation/Endpoints:** `http://221.121.3.136/api`
- 📊 **Grafana Metrics Dashboard:** `http://221.121.3.136:3001` *(Tài khoản: `admin` / `ShopiGrafanaAdminPass2026!`)*
- 📈 **Prometheus Metrics:** `http://221.121.3.136:9090`
- 🗄️ **pgAdmin 4 (Quản trị 3 DB):** `http://221.121.3.136:5050` *(Tài khoản: `admin@shopi.vn` / `AdminShopiSecurePass2026!`)*
- ⚡ **Redis Commander:** `http://221.121.3.136:8085`

---

## 8. Bảng Tổng Hợp Thông Tin Cần Nhớ

| Thông tin | Giá trị |
|---|---|
| **VPS IP** | `221.121.3.136` |
| **SSH User** | `root` |
| **Thư mục cài đặt dự án** | `/opt/shopi` |
| **Tường lửa đã mở** | `22` (SSH), `80` (HTTP), `443` (HTTPS) |
| **Secret 1 trên GitHub** | `VPS_HOST` = `221.121.3.136` |
| **Secret 2 trên GitHub** | `VPS_USER` = `root` |
| **Secret 3 trên GitHub** | `SSH_PRIVATE_KEY` = *(Nội dung file `~/.ssh/shopi_deploy`)* |
| **Lệnh đẩy code** | `git push origin main` |
| **Lệnh redeploy sạch** | Dùng nút **Run workflow** trên GitHub Actions (chọn `redeploy`) |
