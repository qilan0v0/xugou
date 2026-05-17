import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import bcryptjs from 'bcryptjs';
const bcrypt = (bcryptjs as any).default || bcryptjs;
import jsonwebtoken from 'jsonwebtoken';
import { getJwtSecret } from '../utils/jwt';

// 导入 D1 数据库类型
type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec<T = unknown>(query: string): Promise<D1Result<T>>;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: object;
}

// 用户类型定义
interface User {
  id: number;
  username: string;
  password: string;
  email?: string;
  role: string;
  created_at?: string;
  updated_at?: string;
}

const auth = new Hono<{ Bindings: Bindings }>();

// 注册路由
auth.post('/register', async (c) => {
  try {
    const { username, password, email } = await c.req.json();
    
    // 检查用户名是否已存在
    const existingUser = await c.env.DB.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).bind(username).first<User | null>();
    
    if (existingUser) {
      return c.json({ success: false, message: '用户名已存在' }, 400);
    }
    
    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // 创建新用户
    const result = await c.env.DB.prepare(
      'INSERT INTO users (username, password, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      username, 
      hashedPassword, 
      email || null, 
      'user', 
      new Date().toISOString(), 
      new Date().toISOString()
    ).run();
    
    if (!result.success) {
      throw new Error('数据库插入失败');
    }
    
    // 获取新创建的用户ID
    const newUser = await c.env.DB.prepare(
      'SELECT id, username, role FROM users WHERE username = ?'
    ).bind(username).first<{id: number, username: string, role: string}>();
    
    return c.json({ 
      success: true, 
      message: '注册成功',
      user: newUser
    }, 201);
  } catch (error) {
    console.error('注册错误:', error);
    return c.json({ success: false, message: '注册失败' }, 500);
  }
});

// 登录路由
auth.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    
    // 查找用户
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).bind(username).first<User>();
    
    if (!user) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401);
    }
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401);
    }
    
    // 生成JWT令牌
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role
    };
    
    const secret = getJwtSecret(c);
    const token = jsonwebtoken.sign(payload, secret, { expiresIn: '24h' });
    
    return c.json({ 
      success: true, 
      message: '登录成功',
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error('登录错误:', error);
    return c.json({ success: false, message: '登录失败' }, 500);
  }
});

// 获取当前用户信息
auth.use('/me', async (c, next) => {
  const jwtMiddleware = jwt({
    secret: getJwtSecret(c)
  });
  return jwtMiddleware(c, next);
});

auth.get('/me', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    
    const user = await c.env.DB.prepare(
      'SELECT id, username, email, role FROM users WHERE id = ?'
    ).bind(payload.id).first<{id: number, username: string, email?: string, role: string}>();
    
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }
    
    return c.json({ 
      success: true, 
      user
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return c.json({ success: false, message: '获取用户信息失败' }, 500);
  }
});

export default auth; 