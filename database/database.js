const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "1ani.db");

const db = new Database(dbPath);


// ========================================
// KULLANICILAR
// ========================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();


// ========================================
// ANILAR
// ========================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id)
        REFERENCES users(id)
    )
`).run();


// ========================================
// BEĞENİLER
// ========================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        memory_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(user_id, memory_id),

        FOREIGN KEY (user_id)
        REFERENCES users(id),

        FOREIGN KEY (memory_id)
        REFERENCES memories(id)
    )
`).run();


// ========================================
// YORUMLAR
// ========================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        memory_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id)
        REFERENCES users(id),

        FOREIGN KEY (memory_id)
        REFERENCES memories(id)
    )
`).run();


console.log("1 ANI veritabanı hazır.");

module.exports = db;