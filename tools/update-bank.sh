#!/bin/sh
# Tải lại trang nguồn, tạo js/data.js + js/generators.js mới.
# Chỉ ghi đè khi câu hỏi THẬT SỰ thay đổi (tránh commit thừa). Lỗi tải/trích xuất → giữ nguyên file cũ.
set -e
cd "$(dirname "$0")/.."
SRC="https://gilbertmtanofficial-gif.github.io/Computing_topics_for_Grade8/"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

if ! curl -sfL "$SRC" -o "$TMP/index.html"; then
  echo "   ✗ Không tải được trang nguồn (mất mạng?). Giữ nguyên câu hỏi cũ."; exit 1
fi
node tools/extract.js "$TMP/index.html" "$TMP" >/dev/null
node tools/build-data.js "$TMP/raw.json" "$TMP/data.js" >/dev/null
{ echo "/* Bộ sinh câu hỏi ngẫu nhiên (giữ nguyên từ trang nguồn). Mỗi lần gọi tạo một câu mới. */"; cat "$TMP/generators.src.js"; } > "$TMP/generators.js"

# kiểm tra bản mới chạy được và có câu hỏi
count() { node -e 'global.window={};require(process.argv[1]);const q=window.QB;console.log(Object.values(q.bank).flat().length+" câu, "+q.units.length+" unit")' "$1"; }
node --check "$TMP/generators.js"
NEW=$(count "$TMP/data.js")
OLD=$(count "$(pwd)/js/data.js" 2>/dev/null || echo "chưa có")

CHANGED=0
if ! diff -q <(sed 1,3d js/data.js 2>/dev/null) <(sed 1,3d "$TMP/data.js") >/dev/null 2>&1; then cp "$TMP/data.js" js/data.js; CHANGED=1; fi
if ! diff -q js/generators.js "$TMP/generators.js" >/dev/null 2>&1; then cp "$TMP/generators.js" js/generators.js; CHANGED=1; fi

if [ "$CHANGED" = 1 ]; then echo "   ✓ Có câu hỏi mới: $OLD → $NEW"; else echo "   = Câu hỏi không đổi ($NEW)"; fi
