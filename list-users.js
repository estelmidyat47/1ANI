const db = require("./database/database");

const users = db.prepare(`
    SELECT id, username, created_at
    FROM users
`).all();

console.log("Kayıtlı kullanıcılar:");
console.table(users);

db.close();