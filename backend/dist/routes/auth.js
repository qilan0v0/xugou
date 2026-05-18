"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const jwt_1 = require("hono/jwt");
const crypto_1 = __importDefault(require("crypto"));
function hashPassword(password) {
    const salt = crypto_1.default.randomBytes(16).toString('hex');
    const hash = crypto_1.default.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return salt + ':' + hash;
}
function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    const verify = crypto_1.default.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verify;
}
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwt_2 = require("../utils/jwt");
const auth = new hono_1.Hono();
// 注册路由
auth.post('/register', async (c) => {
    try {
        const { username, password, email } = await c.req.json();
        if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
            return c.json({ success: false, message: '用户名和密码不能为空' }, 400);
        }
        if (username.length < 2 || username.length > 50) {
            return c.json({ success: false, message: '用户名长度需在2-50个字符' }, 400);
        }
        if (password.length < 4 || password.length > 100) {
            return c.json({ success: false, message: '密码长度需在4-100个字符' }, 400);
        }
        // 检查用户名是否已存在
        const existingUser = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
        if (existingUser) {
            return c.json({ success: false, message: '用户名已存在' }, 400);
        }
        // 加密密码
        const hashedPassword = hashPassword(password);
        // 创建新用户
        const result = await c.env.DB.prepare('INSERT INTO users (username, password, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(username, hashedPassword, email || null, 'user', new Date().toISOString(), new Date().toISOString()).run();
        if (!result.success) {
            throw new Error('数据库插入失败');
        }
        // 获取新创建的用户ID
        const newUser = await c.env.DB.prepare('SELECT id, username, role FROM users WHERE username = ?').bind(username).first();
        return c.json({
            success: true,
            message: '注册成功',
            user: newUser
        }, 201);
    }
    catch (error) {
        console.error('注册错误:', error);
        return c.json({ success: false, message: '注册失败' }, 500);
    }
});
// 登录路由
auth.post('/login', async (c) => {
    try {
        const { username, password } = await c.req.json();
        if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
            return c.json({ success: false, message: '用户名和密码不能为空' }, 400);
        }
        if (username.length > 50 || password.length > 100) {
            return c.json({ success: false, message: '输入长度超出限制' }, 400);
        }
        // 查找用户
        const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
        if (!user) {
            return c.json({ success: false, message: '用户名或密码错误' }, 401);
        }
        // 验证密码
        const isPasswordValid = verifyPassword(password, user.password);
        if (!isPasswordValid) {
            return c.json({ success: false, message: '用户名或密码错误' }, 401);
        }
        // 生成JWT令牌
        const payload = {
            id: user.id,
            username: user.username,
            role: user.role
        };
        const secret = (0, jwt_2.getJwtSecret)(c);
        const token = jsonwebtoken_1.default.sign(payload, secret, { expiresIn: '24h' });
        return c.json({
            success: true,
            message: '登录成功',
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    }
    catch (error) {
        console.error('登录错误:', error);
        return c.json({ success: false, message: '登录失败' }, 500);
    }
});
// 获取当前用户信息
auth.use('/me', async (c, next) => {
    const jwtMiddleware = (0, jwt_1.jwt)({ alg: "HS256",
        secret: (0, jwt_2.getJwtSecret)(c)
    });
    return jwtMiddleware(c, next);
});
auth.get('/me', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const user = await c.env.DB.prepare('SELECT id, username, email, role FROM users WHERE id = ?').bind(payload.id).first();
        if (!user) {
            return c.json({ success: false, message: '用户不存在' }, 404);
        }
        return c.json({
            success: true,
            user
        });
    }
    catch (error) {
        console.error('获取用户信息错误:', error);
        return c.json({ success: false, message: '获取用户信息失败' }, 500);
    }
});
exports.default = auth;
//# sourceMappingURL=auth.js.map