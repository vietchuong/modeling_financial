# Hướng dẫn sử dụng Dashboard Định giá

Đây là trang web tương tác giúp bạn định giá cổ phiếu Nhựa Bình Minh (BMP) dựa trên các mô hình tài chính: DCF, Monte Carlo, và Phân tích độ nhạy.

## Cách mở Dashboard
1. Vào thư mục `d:\modeling_financial\web`.
2. Mở file `index.html` bằng trình duyệt web của bạn (Chrome, Edge, Firefox).

## Các tính năng
1. **Mô hình DCF**:
   - Thay đổi các giả định (Tăng trưởng, Biên lợi nhuận, WACC...) ở thanh bên trái.
   - Giá trị cổ phiếu (Share Price) sẽ được tính toán lại ngay lập tức.
   
2. **Kịch bản (Scenario Planning)**:
   - Chọn **Base Case**, **Bull Case**, hoặc **Bear Case** ở góc trên bên phải để áp dụng nhanh các bộ giả định khác nhau.

3. **Phân tích độ nhạy (Sensitivity Analysis)**:
   - Xem bảng nhiệt (Heatmap) ở dưới cùng để biết giá cổ phiếu thay đổi ra sao khi WACC và Tốc độ tăng trưởng dài hạn thay đổi.

4. **Mô phỏng Monte Carlo**:
   - Tự động chạy 1000 kịch bản ngẫu nhiên để xem phân phối xác suất của giá trị định giá.

## Dữ liệu
Dữ liệu được lấy từ các file CSV báo cáo tài chính của bạn và được lưu trong `data/financials.js`.
