# Thiết lập tự nhận kết quả qua Google Sheets (làm 1 lần, ~5 phút)

Sau khi thiết lập: học sinh làm xong quiz → kết quả **tự gửi** vào Google Sheet của thầy.
Thầy mở trang **Giáo viên** → kết quả **tự cập nhật** vào bảng lớp. Không cần copy qua Zalo.

## Các bước
1. Mở web (http://localhost:8765) → **Giáo viên** → thẻ **“Tự nhận kết quả (Google Sheets)”** → **Thiết lập ngay**.
2. Mở https://sheets.new (đăng nhập Google của thầy) → tạo Sheet trống, đặt tên VD “Kết quả quiz ICT”.
3. Trong Sheet: **Tiện ích mở rộng → Apps Script** → xóa hết mã có sẵn → trên web bấm **Copy mã** → dán vào → bấm 💾 **Lưu**.
4. **Triển khai → Tùy chọn triển khai mới** → bánh răng ⚙ chọn **Ứng dụng web**:
   - Thực thi với tư cách: **Tôi**
   - Ai có quyền truy cập: **Bất kỳ ai**
   - Bấm **Triển khai** → **Cấp quyền truy cập** → chọn tài khoản → (nếu Google cảnh báo “ứng dụng chưa xác minh”: *Nâng cao → Đi tới … (không an toàn)* — đây là mã của chính thầy) → **Cho phép**.
5. Copy **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`) → dán vào ô trên web → **Kiểm tra** → thấy “✓ Kết nối thành công”.
6. Đưa link vào web cho học sinh: mở `js/config.js`, dán vào dòng
   ```js
   sheetUrl: "https://script.google.com/macros/s/…/exec",
   ```
   (hoặc gửi link cho Claude để cập nhật giúp). Từ giờ máy học sinh tự gửi kết quả.

## Cần biết
- **Mã đọc** (READ_KEY) chỉ nằm trong Apps Script và trên máy thầy → học sinh không đọc được kết quả của nhau.
  Đổi máy thầy: làm lại bước 1–5 với **cùng** Sheet, hoặc dùng “Sao lưu lớp & kết quả”.
- **Mã ghi** (WRITE_KEY = `sheetKey` trong `js/config.js`) không bí mật, chỉ để lọc dữ liệu rác.
- Mỗi học sinh là **một dòng** trong tab `KetQua` (tự cập nhật, không trùng): tên, lớp, số câu, % đúng, chủ điểm yếu, chuỗi ngày…
- Khi sửa mã Apps Script: **Triển khai → Quản lý triển khai → ✏ → Phiên bản mới** để giữ nguyên link.
- Tự gửi **không chạy** trên bản trong khung claude.ai (bị chặn gửi ra ngoài) — chỉ chạy trên localhost / GitHub Pages.
  Mất mạng thì web giữ lại và tự gửi lần sau học sinh mở web. Nút “Gửi kết quả cho thầy” (qua Zalo) vẫn còn để dự phòng.
