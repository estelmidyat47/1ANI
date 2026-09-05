const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
const db = require("../database/database");

const app = express();

const PORT = 3000;

// ========================================
// KURUCU / ADMIN
// ========================================

const FOUNDER_USERNAME = "kurucu475001207";

// ========================================
// VERÝ OKUMA
// ========================================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ========================================
// OTURUM SÝSTEMÝ
// ========================================

app.use(
    session({
        secret: "1-ani-gizli-anahtar",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);

// ========================================
// PUBLIC KLASÖRÜ
// ========================================

app.use(
    express.static(
        path.join(__dirname, "../public")
    )
);

// ========================================
// GÝRÝÞ KONTROLÜ
// ========================================

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            error: "Giriþ yapmalýsýnýz."
        });
    }

    next();
}

// ========================================
// ADMIN KONTROLÜ
// ========================================

function isFounder(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            error: "Giriþ yapmalýsýnýz."
        });
    }

    if (req.session.username !== FOUNDER_USERNAME) {
        return res.status(403).json({
            error: "Bu alana sadece Admin eriþebilir."
        });
    }

    next();
}

// ========================================
// KAYIT OL
// ========================================

app.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.send(
                "Kullanýcý adý ve þifre zorunludur."
            );
        }

        if (username.length < 3) {
            return res.send(
                "Kullanýcý adý en az 3 karakter olmalýdýr."
            );
        }

        if (password.length < 6) {
            return res.send(
                "Þifre en az 6 karakter olmalýdýr."
            );
        }

        const existingUser = db.prepare(`
            SELECT id
            FROM users
            WHERE username = ?
        `).get(username);

        if (existingUser) {
            return res.send(
                "Bu kullanýcý adý zaten alýnmýþ."
            );
        }

        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        db.prepare(`
            INSERT INTO users
            (username, password)
            VALUES (?, ?)
        `).run(
            username,
            hashedPassword
        );

        res.send(
            "Kayýt baþarýlý! Þimdi giriþ yapabilirsiniz."
        );

    } catch (error) {
        console.error(error);

        res.send(
            "Kayýt sýrasýnda bir hata oluþtu."
        );
    }
});

// ========================================
// GÝRÝÞ YAP
// ========================================

app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.send(
                "Kullanýcý adý ve þifre zorunludur."
            );
        }

        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE username = ?
        `).get(username);

        if (!user) {
            return res.send(
                "Kullanýcý adý veya þifre yanlýþ."
            );
        }

        const passwordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordCorrect) {
            return res.send(
                "Kullanýcý adý veya þifre yanlýþ."
            );
        }

        req.session.userId = user.id;
        req.session.username = user.username;

        res.redirect("/home.html");

    } catch (error) {
        console.error(error);

        res.send(
            "Giriþ sýrasýnda bir hata oluþtu."
        );
    }
});

// ========================================
// KULLANICI BÝLGÝLERÝ
// ========================================

app.get("/api/me", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            error: "Giriþ yapmalýsýnýz."
        });
    }

    const isAdmin =
        req.session.username === FOUNDER_USERNAME;

    res.json({
        id: req.session.userId,
        username: req.session.username,
        displayName: isAdmin
            ? "Admin"
            : req.session.username,
        isFounder: isAdmin
    });
});

// ========================================
// ADMIN ÝSTATÝSTÝKLERÝ
// ========================================

app.get(
    "/api/founder/stats",
    isFounder,
    (req, res) => {

        const users = db.prepare(`
            SELECT COUNT(*) AS count
            FROM users
        `).get().count;

        const memories = db.prepare(`
            SELECT COUNT(*) AS count
            FROM memories
        `).get().count;

        const likes = db.prepare(`
            SELECT COUNT(*) AS count
            FROM likes
        `).get().count;

        const comments = db.prepare(`
            SELECT COUNT(*) AS count
            FROM comments
        `).get().count;

        res.json({
            users,
            memories,
            likes,
            comments
        });
    }
);

// ========================================
// TÜM KULLANICILAR - ADMIN
// ========================================

app.get(
    "/api/founder/users",
    isFounder,
    (req, res) => {

        const users = db.prepare(`
            SELECT
                users.id,
                users.username,
                users.created_at,

                (
                    SELECT COUNT(*)
                    FROM memories
                    WHERE memories.user_id = users.id
                ) AS memory_count,

                (
                    SELECT COUNT(*)
                    FROM likes
                    WHERE likes.user_id = users.id
                ) AS like_count,

                (
                    SELECT COUNT(*)
                    FROM comments
                    WHERE comments.user_id = users.id
                ) AS comment_count

            FROM users

            ORDER BY users.id DESC
        `).all();

        res.json(users);
    }
);

// ========================================
// ADMIN - KULLANICI SÝL
// ========================================

app.delete(
    "/api/founder/users/:id",
    isFounder,
    (req, res) => {

        const userId = Number(req.params.id);

        if (!Number.isInteger(userId)) {
            return res.status(400).json({
                error: "Geçersiz kullanýcý."
            });
        }

        const user = db.prepare(`
            SELECT id, username
            FROM users
            WHERE id = ?
        `).get(userId);

        if (!user) {
            return res.status(404).json({
                error: "Kullanýcý bulunamadý."
            });
        }

        // ADMIN KORUMASI
        if (user.username === FOUNDER_USERNAME) {
            return res.status(403).json({
                error: "Admin hesabý silinemez."
            });
        }

        // Kullanýcýnýn yorumlarý
        db.prepare(`
            DELETE FROM comments
            WHERE user_id = ?
        `).run(userId);

        // Kullanýcýnýn beðenileri
        db.prepare(`
            DELETE FROM likes
            WHERE user_id = ?
        `).run(userId);

        // Kullanýcýnýn anýlarýna ait yorumlar
        db.prepare(`
            DELETE FROM comments
            WHERE memory_id IN (
                SELECT id
                FROM memories
                WHERE user_id = ?
            )
        `).run(userId);

        // Kullanýcýnýn anýlarýna ait beðeniler
        db.prepare(`
            DELETE FROM likes
            WHERE memory_id IN (
                SELECT id
                FROM memories
                WHERE user_id = ?
            )
        `).run(userId);

        // Kullanýcýnýn anýlarý
        db.prepare(`
            DELETE FROM memories
            WHERE user_id = ?
        `).run(userId);

        // Kullanýcý
        db.prepare(`
            DELETE FROM users
            WHERE id = ?
        `).run(userId);

        res.json({
            success: true,
            message: "Kullanýcý ve içerikleri silindi."
        });
    }
);

// ========================================
// TÜM ANILARI GETÝR
// ========================================

app.get("/api/memories", requireLogin, (req, res) => {

    const memories = db.prepare(`
        SELECT
            memories.id,
            memories.title,
            memories.content,
            memories.created_at,
            users.username,

            (
                SELECT COUNT(*)
                FROM likes
                WHERE likes.memory_id = memories.id
            ) AS like_count,

            EXISTS (
                SELECT 1
                FROM likes
                WHERE likes.memory_id = memories.id
                AND likes.user_id = ?
            ) AS liked,

            (
                SELECT COUNT(*)
                FROM comments
                WHERE comments.memory_id = memories.id
            ) AS comment_count

        FROM memories

        JOIN users
        ON memories.user_id = users.id

        ORDER BY memories.id DESC
    `).all(req.session.userId);

    res.json(memories);
});

// ========================================
// ADMIN - TÜM ANILAR
// ========================================

app.get(
    "/api/founder/memories",
    isFounder,
    (req, res) => {

        const memories = db.prepare(`
            SELECT
                memories.id,
                memories.title,
                memories.content,
                memories.created_at,
                memories.user_id,
                users.username,

                (
                    SELECT COUNT(*)
                    FROM likes
                    WHERE likes.memory_id = memories.id
                ) AS like_count,

                (
                    SELECT COUNT(*)
                    FROM comments
                    WHERE comments.memory_id = memories.id
                ) AS comment_count

            FROM memories

            JOIN users
            ON memories.user_id = users.id

            ORDER BY memories.id DESC
        `).all();

        res.json(memories);
    }
);

// ========================================
// ADMIN - ANI SÝL
// ========================================

app.delete(
    "/api/founder/memories/:id",
    isFounder,
    (req, res) => {

        const memoryId = Number(req.params.id);

        if (!Number.isInteger(memoryId)) {
            return res.status(400).json({
                error: "Geçersiz aný."
            });
        }

        const memory = db.prepare(`
            SELECT id
            FROM memories
            WHERE id = ?
        `).get(memoryId);

        if (!memory) {
            return res.status(404).json({
                error: "Aný bulunamadý."
            });
        }

        db.prepare(`
            DELETE FROM comments
            WHERE memory_id = ?
        `).run(memoryId);

        db.prepare(`
            DELETE FROM likes
            WHERE memory_id = ?
        `).run(memoryId);

        db.prepare(`
            DELETE FROM memories
            WHERE id = ?
        `).run(memoryId);

        res.json({
            success: true,
            message: "Aný silindi."
        });
    }
);

// ========================================
// ADMIN - TÜM YORUMLAR
// ========================================

app.get(
    "/api/founder/comments",
    isFounder,
    (req, res) => {

        const comments = db.prepare(`
            SELECT
                comments.id,
                comments.content,
                comments.created_at,
                comments.user_id,
                comments.memory_id,
                users.username,
                memories.title AS memory_title

            FROM comments

            JOIN users
            ON comments.user_id = users.id

            JOIN memories
            ON comments.memory_id = memories.id

            ORDER BY comments.id DESC
        `).all();

        res.json(comments);
    }
);

// ========================================
// ADMIN - YORUM SÝL
// ========================================

app.delete(
    "/api/founder/comments/:id",
    isFounder,
    (req, res) => {

        const commentId = Number(req.params.id);

        if (!Number.isInteger(commentId)) {
            return res.status(400).json({
                error: "Geçersiz yorum."
            });
        }

        const comment = db.prepare(`
            SELECT id
            FROM comments
            WHERE id = ?
        `).get(commentId);

        if (!comment) {
            return res.status(404).json({
                error: "Yorum bulunamadý."
            });
        }

        db.prepare(`
            DELETE FROM comments
            WHERE id = ?
        `).run(commentId);

        res.json({
            success: true,
            message: "Yorum silindi."
        });
    }
);

// ========================================
// ANI PAYLAÞ
// ========================================

app.post("/api/memories", requireLogin, (req, res) => {

    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({
            error: "Baþlýk ve aný zorunludur."
        });
    }

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (!cleanTitle || !cleanContent) {
        return res.status(400).json({
            error: "Baþlýk ve aný boþ býrakýlamaz."
        });
    }

    db.prepare(`
        INSERT INTO memories
        (user_id, title, content)
        VALUES (?, ?, ?)
    `).run(
        req.session.userId,
        cleanTitle,
        cleanContent
    );

    res.json({
        success: true,
        message: "Anýn baþarýyla paylaþýldý!"
    });
});

// ========================================
// ANI DÜZENLE
// ========================================

app.put(
    "/api/memories/:id",
    requireLogin,
    (req, res) => {

        const memoryId = req.params.id;
        const { title, content } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                error: "Baþlýk ve aný zorunludur."
            });
        }

        const cleanTitle = title.trim();
        const cleanContent = content.trim();

        if (!cleanTitle || !cleanContent) {
            return res.status(400).json({
                error: "Baþlýk ve aný boþ býrakýlamaz."
            });
        }

        const memory = db.prepare(`
            SELECT id
            FROM memories
            WHERE id = ?
            AND user_id = ?
        `).get(
            memoryId,
            req.session.userId
        );

        if (!memory) {
            return res.status(403).json({
                error: "Bu anýyý düzenleme yetkiniz yok."
            });
        }

        db.prepare(`
            UPDATE memories
            SET
                title = ?,
                content = ?
            WHERE id = ?
            AND user_id = ?
        `).run(
            cleanTitle,
            cleanContent,
            memoryId,
            req.session.userId
        );

        res.json({
            success: true,
            message: "Aný baþarýyla düzenlendi."
        });
    }
);

// ========================================
// ANI BEÐEN / BEÐENME
// ========================================

app.post(
    "/api/memories/:id/like",
    requireLogin,
    (req, res) => {

        const memoryId = req.params.id;

        const memory = db.prepare(`
            SELECT id
            FROM memories
            WHERE id = ?
        `).get(memoryId);

        if (!memory) {
            return res.status(404).json({
                error: "Aný bulunamadý."
            });
        }

        const existingLike = db.prepare(`
            SELECT id
            FROM likes
            WHERE user_id = ?
            AND memory_id = ?
        `).get(
            req.session.userId,
            memoryId
        );

        if (existingLike) {

            db.prepare(`
                DELETE FROM likes
                WHERE user_id = ?
                AND memory_id = ?
            `).run(
                req.session.userId,
                memoryId
            );

            const count = db.prepare(`
                SELECT COUNT(*) AS count
                FROM likes
                WHERE memory_id = ?
            `).get(memoryId);

            return res.json({
                liked: false,
                likeCount: count.count
            });
        }

        db.prepare(`
            INSERT INTO likes
            (user_id, memory_id)
            VALUES (?, ?)
        `).run(
            req.session.userId,
            memoryId
        );

        const count = db.prepare(`
            SELECT COUNT(*) AS count
            FROM likes
            WHERE memory_id = ?
        `).get(memoryId);

        res.json({
            liked: true,
            likeCount: count.count
        });
    }
);

// ========================================
// YORUMLARI GETÝR
// ========================================

app.get(
    "/api/memories/:id/comments",
    requireLogin,
    (req, res) => {

        const memoryId = req.params.id;

        const memory = db.prepare(`
            SELECT id
            FROM memories
            WHERE id = ?
        `).get(memoryId);

        if (!memory) {
            return res.status(404).json({
                error: "Aný bulunamadý."
            });
        }

        const comments = db.prepare(`
            SELECT
                comments.id,
                comments.content,
                comments.created_at,
                users.username

            FROM comments

            JOIN users
            ON comments.user_id = users.id

            WHERE comments.memory_id = ?

            ORDER BY comments.id ASC
        `).all(memoryId);

        res.json(comments);
    }
);

// ========================================
// YORUM EKLE
// ========================================

app.post(
    "/api/memories/:id/comments",
    requireLogin,
    (req, res) => {

        const memoryId = req.params.id;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({
                error: "Yorum boþ býrakýlamaz."
            });
        }

        const memory = db.prepare(`
            SELECT id
            FROM memories
            WHERE id = ?
        `).get(memoryId);

        if (!memory) {
            return res.status(404).json({
                error: "Aný bulunamadý."
            });
        }

        const comment = content.trim();

        if (comment.length > 1000) {
            return res.status(400).json({
                error: "Yorum en fazla 1000 karakter olabilir."
            });
        }

        db.prepare(`
            INSERT INTO comments
            (user_id, memory_id, content)
            VALUES (?, ?, ?)
        `).run(
            req.session.userId,
            memoryId,
            comment
        );

        res.json({
            success: true,
            message: "Yorum eklendi."
        });
    }
);

// ========================================
// ANI SÝL
// ========================================

app.delete(
    "/api/memories/:id",
    requireLogin,
    (req, res) => {

        const memoryId = req.params.id;

        const memory = db.prepare(`
            SELECT id
            FROM memories
            WHERE id = ?
            AND user_id = ?
        `).get(
            memoryId,
            req.session.userId
        );

        if (!memory) {
            return res.status(403).json({
                error: "Bu anýyý silme yetkiniz yok."
            });
        }

        db.prepare(`
            DELETE FROM comments
            WHERE memory_id = ?
        `).run(memoryId);

        db.prepare(`
            DELETE FROM likes
            WHERE memory_id = ?
        `).run(memoryId);

        db.prepare(`
            DELETE FROM memories
            WHERE id = ?
            AND user_id = ?
        `).run(
            memoryId,
            req.session.userId
        );

        res.json({
            success: true,
            message: "Aný baþarýyla silindi."
        });
    }
);

// ========================================
// ÇIKIÞ YAP
// ========================================

app.post("/logout", (req, res) => {

    req.session.destroy(() => {
        res.redirect("/login.html");
    });

});

// ========================================
// SUNUCU
// ========================================

app.listen(PORT, () => {
    console.log(
        `1 ANI çalýþýyor: http://localhost:${PORT}`
    );
});