import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import bcryptjs from 'bcryptjs';
const bcrypt = (bcryptjs as any).default || bcryptjs;
const { compare, hash } = bcrypt;
import { Bindings } from '../models/db';
import { getJwtSecret } from '../utils/jwt';

// 用户类型定义
interface User {
  id: number;
  username: string;
  password: string;
  email: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

const users = new Hono<{ Bindings: Bindings }>();

// 中间件：JWT 认证
users.use('*', async (c, next) => {
  const jwtMiddleware = jwt({
    secret: getJwtSecret(c)
  });
  return jwtMiddleware(c, next);
});

// 获取所有用户（仅管理员）
users.get('/', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    
    // 检查权限
    if (payload.role !== 'admin') {
      return c.json({ success: false, message: '无权访问用户列表' }, 403);
    }
    
    // 查询所有用户，不包括密码
    const result = await c.env.DB.prepare(
      'SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY id'
    ).all<Omit<User, 'password'>>();
    
    return c.json({ success: true, users: result.results });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    return c.json({ success: false, message: '获取用户列表失败' }, 500);
  }
});

// 获取单个用户
users.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const payload = c.get('jwtPayload');
    
    // 检查权限（仅允许管理员或用户本人）
    if (payload.role !== 'admin' && payload.id !== id) {
      return c.json({ success: false, message: '无权访问此用户信息' }, 403);
    }
    
    // 查询用户，不包括密码
    const user = await c.env.DB.prepare(
      'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?'
    ).bind(id).first<Omit<User, 'password'>>();
    
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }
    
    return c.json({ success: true, user });
  } catch (error) {
    console.error('获取用户详情错误:', error);
    return c.json({ success: false, message: '获取用户详情失败' }, 500);
  }
});

// 创建用户（仅管理员）
users.post('/', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    
    // 检查权限
    if (payload.role !== 'admin') {
      return c.json({ success: false, message: '无权创建用户' }, 403);
    }
    
    const data = await c.req.json();
    
    // 验证必填字段
    if (!data.username || !data.password || !data.role) {
      return c.json({ success: false, message: '缺少必填字段' }, 400);
    }
    
    // 检查用户名是否已存在
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(data.username).first();
    
    if (existingUser) {
      return c.json({ success: false, message: '用户名已存在' }, 400);
    }
    
    // 检查角色是否有效
    const validRoles = ['admin', 'manager', 'viewer'];
    if (!validRoles.includes(data.role)) {
      return c.json({ success: false, message: '无效的角色' }, 400);
    }
    
    // 哈希密码
    const hashedPassword = await hash(data.password, 10);
    const now = new Date().toISOString();
    
    // 插入新用户
    const result = await c.env.DB.prepare(
      `INSERT INTO users (username, password, email, role, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      data.username,
      hashedPassword,
      data.email || null,
      data.role,
      now,
      now
    ).run();
    
    if (!result.success) {
      throw new Error('创建用户失败');
    }
    
    // 获取新创建的用户
    const newUser = await c.env.DB.prepare(
      'SELECT id, username, email, role, created_at, updated_at FROM users WHERE rowid = last_insert_rowid()'
    ).first<Omit<User, 'password'>>();
    
    return c.json({ success: true, user: newUser }, 201);
  } catch (error) {
    console.error('创建用户错误:', error);
    return c.json({ success: false, message: '创建用户失败' }, 500);
  }
});

// 更新用户
users.put('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const payload = c.get('jwtPayload');
    
    // 检查权限（仅允许管理员或用户本人）
    if (payload.role !== 'admin' && payload.id !== id) {
      return c.json({ success: false, message: '无权修改此用户信息' }, 403);
    }
    
    // 检查用户是否存在
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).first<User>();
    
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }
    
    const data = await c.req.json();
    
    // 非管理员不能修改角色
    if (payload.role !== 'admin' && data.role && data.role !== user.role) {
      return c.json({ success: false, message: '无权修改用户角色' }, 403);
    }
    
    // 准备更新数据
    const updates = [];
    const values = [];
    
    if (data.username !== undefined) {
      // 检查新用户名是否已存在
      if (data.username !== user.username) {
        const existingUser = await c.env.DB.prepare(
          'SELECT id FROM users WHERE username = ? AND id != ?'
        ).bind(data.username, id).first();
        
        if (existingUser) {
          return c.json({ success: false, message: '用户名已存在' }, 400);
        }
        
        updates.push('username = ?');
        values.push(data.username);
      }
    }
    
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email);
    }
    
    if (data.role !== undefined) {
      updates.push('role = ?');
      values.push(data.role);
    }
    
    // 如果提供了新密码，则更新密码
    if (data.password) {
      const hashedPassword = await hash(data.password, 10);
      updates.push('password = ?');
      values.push(hashedPassword);
    }
    
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    
    // 添加 ID 作为 WHERE 条件
    values.push(id);
    
    // 如果没有要更新的字段，直接返回
    if (updates.length <= 1) {
      return c.json({ success: false, message: '没有提供要更新的字段' }, 400);
    }
    
    // 执行更新
    const result = await c.env.DB.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();
    
    if (!result.success) {
      throw new Error('更新用户失败');
    }
    
    // 获取更新后的用户
    const updatedUser = await c.env.DB.prepare(
      'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?'
    ).bind(id).first<Omit<User, 'password'>>();
    
    return c.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('更新用户错误:', error);
    return c.json({ success: false, message: '更新用户失败' }, 500);
  }
});

// 删除用户（仅管理员）
users.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const payload = c.get('jwtPayload');
    
    // 检查权限
    if (payload.role !== 'admin') {
      return c.json({ success: false, message: '无权删除用户' }, 403);
    }
    
    // 防止删除自己
    if (payload.id === id) {
      return c.json({ success: false, message: '不能删除当前登录的用户' }, 400);
    }
    
    // 检查用户是否存在
    const user = await c.env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(id).first();
    
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }
    
    // 执行删除
    const result = await c.env.DB.prepare(
      'DELETE FROM users WHERE id = ?'
    ).bind(id).run();
    
    if (!result.success) {
      throw new Error('删除用户失败');
    }
    
    return c.json({ success: true, message: '用户已删除' });
  } catch (error) {
    console.error('删除用户错误:', error);
    return c.json({ success: false, message: '删除用户失败' }, 500);
  }
});

// 修改密码
users.post('/:id/change-password', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const payload = c.get('jwtPayload');
    
    // 检查权限（仅允许用户本人或管理员）
    if (payload.role !== 'admin' && payload.id !== id) {
      return c.json({ success: false, message: '无权修改此用户密码' }, 403);
    }
    
    const { currentPassword, newPassword } = await c.req.json();
    
    // 管理员可以不提供当前密码
    if (payload.role !== 'admin' && !currentPassword) {
      return c.json({ success: false, message: '必须提供当前密码' }, 400);
    }
    
    if (!newPassword) {
      return c.json({ success: false, message: '必须提供新密码' }, 400);
    }
    
    // 获取用户
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).first<User>();
    
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }
    
    // 非管理员需要验证当前密码
    if (payload.role !== 'admin') {
      const isPasswordValid = await compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return c.json({ success: false, message: '当前密码不正确' }, 400);
      }
    }
    
    // 哈希新密码
    const hashedPassword = await hash(newPassword, 10);
    
    // 更新密码
    const result = await c.env.DB.prepare(
      'UPDATE users SET password = ?, updated_at = ? WHERE id = ?'
    ).bind(
      hashedPassword,
      new Date().toISOString(),
      id
    ).run();
    
    if (!result.success) {
      throw new Error('更新密码失败');
    }
    
    return c.json({ success: true, message: '密码已更新' });
  } catch (error) {
    console.error('修改密码错误:', error);
    return c.json({ success: false, message: '修改密码失败' }, 500);
  }
});

export default users; 