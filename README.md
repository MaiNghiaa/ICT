# Quiz mỗi ngày — Lớp Thầy Nghĩa

## Hành trình
**Thầy (trang “Giáo viên”)**
1. **Tạo lớp** — tên lớp, môn (ngân hàng câu hỏi), khối.
2. **Thêm học sinh** — từng em hoặc dán cả danh sách (`Tên, 7` nếu khác khối). Mỗi em có **mã vào lớp** 10 ký tự, VD `18QVD-2FZYA`.
3. **Gửi mã** — nút “Copy tin nhắn” (có sẵn link + mã) → dán vào Zalo cho em.
4. **Học sinh làm quiz mỗi ngày.**
5. **Nhận kết quả** — em bấm “📤 Gửi kết quả cho thầy” → gửi Zalo; thầy copy tin nhắn → “Dán kết quả học sinh”. Bảng lớp cập nhật ngay.

**Học sinh**: bấm link thầy gửi → “Vào lớp” (hoặc mở web, nhập mã, gõ tên) → làm quiz → gửi kết quả cho thầy.

Ghi chú:
- **Tự nhận kết quả**: kết nối Google Sheets theo [HUONG-DAN-GOOGLE-SHEETS.md](HUONG-DAN-GOOGLE-SHEETS.md) — học sinh không cần gửi Zalo nữa.
- Mã tự chứa môn/khối/lớp/học sinh nên không cần máy chủ; có ký tự kiểm tra để bắt lỗi gõ sai.
- Lớp & kết quả lưu trên trình duyệt của thầy → dùng “Sao lưu lớp & kết quả” để chuyển máy.
- Có thể đặt PIN giáo viên để học sinh dùng chung máy không vào khu giáo viên.
- Môn học khai báo trong `js/config.js` (`code` cố định vì nằm trong mã học sinh). Khối < 8 học ICT tự đi chậm từ bài đầu.
- Link `localhost` chỉ mở được trên máy chạy web; học sinh dùng máy khác cần web được đưa lên mạng (hoặc nhập mã trên bản web đó).

## Chạy
- Mở trực tiếp `index.html` bằng trình duyệt, **hoặc**
- `python3 -m http.server 8765` rồi vào http://localhost:8765
- Có thể đưa cả thư mục lên GitHub Pages / Netlify để học sinh dùng qua link.

## Có gì
| Trang | Chức năng |
|---|---|
| Hôm nay | Quiz tự tạo mỗi ngày (mặc định 15 câu), cố định trong ngày |
| Luyện tập | Luyện theo unit / bài / chủ điểm, ôn câu sai, tổng ôn |
| Thống kê | % đúng theo mạch kiến thức, dạng câu, Unit → Bài, chủ điểm; xu hướng 14 ngày; xuất CSV/JSON |
| Câu sai | Sổ tay lỗi sai, lọc theo mạch |
| Tiến độ | Theo lịch tuần (tự động theo ngày) hoặc tự chọn bài đã học; số câu/ngày |
| Giáo viên | Gộp dữ liệu nhiều học sinh (nhập file JSON học sinh gửi) |

**Dạng câu:** một đáp án · nhiều đáp án · Đúng/Sai · điền đáp án · nối cặp.

## Đề hằng ngày được tạo thế nào
1. ~40% câu thuộc **bài đang học** (tuần hiện tại theo lịch, hoặc bài đánh dấu ⭐).
2. ~25% **câu từng sai đến hạn ôn** (spaced repetition: sai → hỏi lại ngày mai; đúng → giãn 2/4/7/15/30 ngày).
3. Còn lại: **chủ điểm yếu & ôn tập** trong các bài đã học, chọn ngẫu nhiên có trọng số (càng yếu càng hay ra).
Đề dùng seed theo (học sinh + ngày) nên mở lại vẫn ra đúng đề hôm đó.

## Dữ liệu
- Câu hỏi: `js/data.js` (605 câu, 44 chủ điểm, 48 bài) + `js/generators.js` (16 bộ sinh câu ngẫu nhiên),
  trích xuất từ https://gilbertmtanofficial-gif.github.io/Computing_topics_for_Grade8/
- Cập nhật khi trang nguồn thay đổi: `sh tools/update-bank.sh`
- Kết quả làm bài lưu trong `localStorage` của trình duyệt (mỗi máy/trình duyệt riêng). Học sinh bấm
  **“Xuất dữ liệu (gửi thầy)”** để gửi file JSON; thầy nhập ở trang **Giáo viên**.
