/* =====================================================================
   CẤU HÌNH CHUNG — Lớp Thầy Nghĩa
   Lớp học và học sinh do thầy tự tạo trên web (trang "Giáo viên").
   File này chỉ khai báo các MÔN / ngân hàng câu hỏi có thể chọn khi tạo lớp.
   - code: số cố định (1–31), nằm trong mã vào lớp của học sinh → KHÔNG đổi
           số của môn đã dùng, chỉ thêm môn mới với số mới.
   - bank: ngân hàng câu hỏi. "ict8" = Computing (đã có 605 câu).
           null = chưa có câu hỏi (web báo "thầy đang soạn").
   - grades: các khối có thể chọn. Lớp ICT: khối < 8 tự đi chậm từ bài đầu.
   ===================================================================== */
window.SITE = {
  teacher: "Thầy Nghĩa",
  // Link web công khai (dùng để tạo link gửi học sinh khi web chạy trong khung claude.ai)
  url: "https://claude.ai/artifact/H5EPznpc7WekxNhyFKuiuP",
  // Tự gửi kết quả về Google Sheets của thầy (xem trang Giáo viên → "Tự nhận kết quả").
  // sheetUrl: dán "URL ứng dụng web" của Apps Script vào đây. Để trống = tắt tự gửi.
  sheetUrl: "",
  // Mã ghi (không bí mật, chỉ để lọc dữ liệu rác). Phải trùng WRITE_KEY trong Apps Script.
  sheetKey: "w-dn41pakri1q075",
  // Mật khẩu khu giáo viên (chỉ lưu mã băm, không lưu mật khẩu). Đặt/đổi bằng lệnh:  sh capnhat.sh matkhau
  teacherSalt: "808d3ec153333ea3",
  teacherHash: "457aea53f4d698030b640771f4000089102ee960b22527bcf1ac0884f79b8623"
};

window.COURSES = [
  { code: 1, key: "ict8", name: "Tin học (ICT / Computing)", short: "ICT", mark: "ICT", bank: "ict8",
    grades: [8, 7], note: "Cambridge Lower Secondary Computing — lớp 8 (khối 7 học chung, đi chậm hơn)" }
  // Môn Toán tạm ẩn — bỏ dấu // ở 2 dòng dưới (và thêm dấu phẩy sau dòng ICT) khi có câu hỏi:
  // { code: 2, key: "toan5", name: "Toán (Cambridge Maths)", short: "Toán", mark: "TOÁN", bank: null,
  //   grades: [5], note: "Cambridge Primary Mathematics — câu hỏi đang được soạn" }
];
