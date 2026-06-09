import { api } from './api'
import type { LoginResponse } from '@/types/Auth'

export async function loginService(email: string, password: string): Promise<LoginResponse> {
  const res = await api
    .post('auth/login', {
      json: {
        email,
        password,
      },
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    })
    .json<LoginResponse>()

  localStorage.setItem('token', res.refreshToken)
  localStorage.setItem('email', email)

  return res
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token')
}
