import api from './index';
import { User } from './auth';

export interface UserResponse {
  success: boolean;
  message?: string;
  user?: User;
  users?: User[];
}

export interface CreateUserRequest {
  username: string;
  password: string;
  email?: string;
  role: string;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  role?: string;
  password?: string;
}

export interface ChangePasswordRequest {
  currentPassword?: string;
  newPassword: string;
}

// 获取所有用户
export const getAllUsers = async (): Promise<UserResponse> => {
  const response = await api.get<UserResponse>('/api/users');
  return response.data;
};

// 获取单个用户
export const getUser = async (id: number): Promise<UserResponse> => {
  const response = await api.get<UserResponse>(`/api/users/${id}`);
  return response.data;
};

// 创建用户
export const createUser = async (data: CreateUserRequest): Promise<UserResponse> => {
  const response = await api.post<UserResponse>('/api/users', data);
  return response.data;
};

// 更新用户
export const updateUser = async (id: number, data: UpdateUserRequest): Promise<UserResponse> => {
  const response = await api.put<UserResponse>(`/api/users/${id}`, data);
  return response.data;
};

// 删除用户
export const deleteUser = async (id: number): Promise<UserResponse> => {
  const response = await api.delete<UserResponse>(`/api/users/${id}`);
  return response.data;
};

// 修改密码
export const changePassword = async (id: number, data: ChangePasswordRequest): Promise<UserResponse> => {
  const response = await api.post<UserResponse>(`/api/users/${id}/change-password`, data);
  return response.data;
}; 