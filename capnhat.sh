#!/bin/sh
# ==================================================================
#  CẬP NHẬT WEB QUIZ ICT — Lớp Thầy Nghĩa
#  Chạy:   sh capnhat.sh
#  Đổi mật khẩu khu giáo viên:   sh capnhat.sh matkhau
#
#  1. Tải câu hỏi mới nhất từ trang của Mr. Gilbert
#  2. Kiểm tra web không có lỗi
#  3. Đẩy lên GitHub → Vercel tự cập nhật web sau ~1 phút
#
#  Lần đầu chạy: script hỏi link repo GitHub (và tên/email nếu máy chưa có)
#  rồi tự thiết lập. Những lần sau chỉ cần chạy lại lệnh trên.
#  Dữ liệu học sinh KHÔNG bị ảnh hưởng (nằm trong trình duyệt, không ở đây).
# ==================================================================
cd "$(dirname "$0")" || exit 1

# --- Mật khẩu khu giáo viên: hỏi khi chưa có, hoặc khi chạy: sh capnhat.sh matkhau ---
if [ "$1" = "matkhau" ] || grep -q 'teacherHash: ""' js/config.js; then
  echo "▶ Đặt mật khẩu khu giáo viên (học sinh không vào được khu giáo viên nếu không biết)."
  while :; do
    printf "   Mật khẩu mới (ít nhất 6 ký tự, gõ sẽ không hiện): "; stty -echo 2>/dev/null; read -r P1; stty echo 2>/dev/null; echo
    printf "   Nhập lại mật khẩu: "; stty -echo 2>/dev/null; read -r P2; stty echo 2>/dev/null; echo
    if [ "$P1" != "$P2" ]; then echo "   ✗ Hai lần nhập không khớp, nhập lại."; continue; fi
    PW="$P1" node tools/set-password.js && break
  done
  unset P1 P2
fi

echo "▶ 1/3 Tải câu hỏi mới…"
sh tools/update-bank.sh || echo "   (bỏ qua bước này — vẫn tiếp tục đẩy các thay đổi khác)"

echo "▶ 2/3 Kiểm tra web…"
command -v node >/dev/null || { echo "✗ Máy chưa có Node.js (cần để kiểm tra)."; exit 1; }
for f in js/config.js js/data.js js/generators.js js/app.js; do
  node --check "$f" 2>/dev/null || { echo "✗ File $f đang bị lỗi — CHƯA đẩy lên. Gửi thông báo này cho Claude để sửa."; node --check "$f"; exit 1; }
done
echo "   ✓ Không có lỗi"

echo "▶ 3/3 Đẩy lên GitHub…"
command -v git >/dev/null || { echo "✗ Máy chưa có git."; exit 1; }
if [ ! -d .git ]; then
  echo "   Lần đầu — thiết lập kết nối GitHub."
  printf "   Dán link repo GitHub (VD https://github.com/ten-cua-thay/quiz-ict.git): "
  read -r URL
  [ -n "$URL" ] || { echo "✗ Chưa nhập link repo."; exit 1; }
  git init -q && git branch -M main && git remote add origin "$URL" || exit 1
fi
if [ -z "$(git config user.name)" ]; then printf "   Tên hiển thị trên GitHub: "; read -r N; git config user.name "$N"; fi
if [ -z "$(git config user.email)" ]; then printf "   Email tài khoản GitHub: "; read -r E; git config user.email "$E"; fi

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -q -m "Cập nhật $(date '+%Y-%m-%d %H:%M')" && echo "   ✓ Đã lưu thay đổi"
fi
if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1 && [ -z "$(git log '@{u}..HEAD' --oneline 2>/dev/null)" ]; then
  echo "   = Không có gì mới — web đang là bản mới nhất."; exit 0
fi
if git push -q -u origin main; then
  echo "✓ Xong! Vercel sẽ cập nhật web sau khoảng 1 phút."
else
  echo "✗ Chưa đẩy được lên GitHub. Thường do chưa đăng nhập — chạy:  gh auth login  rồi  gh auth setup-git"
  echo "  (thay đổi đã được lưu; sửa xong chỉ cần chạy lại: sh capnhat.sh)"
  exit 1
fi
