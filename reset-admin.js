const bcrypt = require("bcrypt");
const db = require("./database/database");

async function resetAdmin() {
    const newPassword = "mardin123estel";

    const hashedPassword = await bcrypt.hash(
        newPassword,
        10
    );

    const result = db.prepare(`
        UPDATE users
        SET password = ?
        WHERE username = ?
    `).run(
        hashedPassword,
        "kurucu475001207"
    );

    if (result.changes === 0) {
        console.log("❌ kurucu475001207 hesabı bulunamadı.");
    } else {
        console.log("✅ Admin şifresi başarıyla değiştirildi.");
        console.log("Kullanıcı adı: kurucu475001207");
        console.log("Şifre: mardin123estel");
    }

    db.close();
}

resetAdmin();