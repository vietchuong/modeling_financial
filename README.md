# Financial Modeling & Valuation Tool

Dự án này cung cấp một bộ công cụ để xây dựng và phân tích các mô hình tài chính, tập trung vào định giá doanh nghiệp theo phương pháp Chiết khấu Dòng tiền (DCF). Dự án bao gồm các script xử lý dữ liệu tài chính từ file CSV và một giao diện web (Next.js) để trực quan hóa kết quả.

## 🚀 Cấu Trúc Dự Án

*   **`data/`**: Chứa dữ liệu đầu vào dưới dạng file CSV (`kqkd.csv`, `cdkt.csv`, `lctt.csv`).
*   **`scripts/`**: Chứa các script Python để xử lý dữ liệu và chạy mô hình định giá.
*   **`web/`**: Mã nguồn ứng dụng web (Next.js) để hiển thị biểu đồ và báo cáo.
*   **`creating-financial-models/`**: (Thư mục cũ chứa code tham khảo hoặc module gốc).

## 🛠️ Cài Đặt và Chạy Dự Án

### 1. Yêu cầu

*   [Node.js](https://nodejs.org/) (cho Web App)
*   [Python](https://www.python.org/) (để chạy các script xử lý dữ liệu)

### 2. Cài đặt

Tại thự mục gốc của dự án, chạy lệnh sau để cài đặt các thư viện cần thiết cho cả Web App:

```bash
npm install
npm run setup
```

### 3. Xử lý Dữ liệu

Nếu bạn cập nhật lại các file CSV trong thư mục `data/`, hãy chạy lệnh sau để cập nhật dữ liệu cho Web App:

```bash
npm run data:process
```
Lệnh này sẽ chạy script Python để chuyển đổi dữ liệu CSV thành JSON mà Web App có thể đọc được.

### 4. Chạy Web App (Local)

Để khởi động Web App trên máy tính của bạn:

```bash
npm run web:dev
```
Truy cập [http://localhost:3000](http://localhost:3000) để xem kết quả.

## 🌐 Deploy lên Vercel (Để chia sẻ Link)

Dự án này được tối ưu để deploy lên [Vercel](https://vercel.com).

1.  Đẩy code của bạn lên GitHub.
2.  Tạo tài khoản Vercel và liên kết với GitHub.
3.  Tạo dự án mới trên Vercel và chọn repository này.
4.  **Quan trọng**: Trong phần "Framework Preset", chọn **Next.js**.
5.  **Quan trọng**: Trong phần "Root Directory", hãy chọn **`web`** (vì mã nguồn web nằm trong thư mục này).
6.  Nhấn **Deploy**.

Sau khi deploy thành công, Vercel sẽ cung cấp cho bạn một đường link (ví dụ: `project-name.vercel.app`) để bạn chia sẻ.
