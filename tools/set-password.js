// Đặt mật khẩu khu giáo viên: ghi salt + mã băm SHA-256 vào js/config.js (không lưu mật khẩu gốc).
// Mật khẩu truyền qua biến môi trường PW (không hiện trên dòng lệnh).
const fs = require("fs"), crypto = require("crypto"), path = require("path");
const pw = process.env.PW || "";
if (pw.length < 6) { console.error("   ✗ Mật khẩu cần ít nhất 6 ký tự."); process.exit(1); }
const file = path.join(__dirname, "..", "js", "config.js");
let s = fs.readFileSync(file, "utf8");
const salt = crypto.randomBytes(8).toString("hex");
const hash = crypto.createHash("sha256").update(salt + ":" + pw, "utf8").digest("hex");
const before = s;
s = s.replace(/teacherSalt:\s*"[^"]*"/, `teacherSalt: "${salt}"`).replace(/teacherHash:\s*"[^"]*"/, `teacherHash: "${hash}"`);
if (s === before || !s.includes(hash)) { console.error("   ✗ Không tìm thấy dòng teacherSalt / teacherHash trong js/config.js."); process.exit(1); }
fs.writeFileSync(file, s);
console.log("   ✓ Đã đặt mật khẩu giáo viên.");
