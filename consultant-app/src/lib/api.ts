const API_BASE_URL = '/api';

export interface LoginCredentials {
  username?: string;
  email?: string;
  password: string;
}

export interface ConsultantRegistration {
  username: string;
  email: string;
  password: string;
  fullName: string;
  specialization: 'nutritionist' | 'veterinarian';
}

export interface User {
  id: number;
  username: string;
  email: string;
  userType: 'consultant' | 'producer' | 'staff';
}

export interface ConsultantProfile {
  id: number;
  userId: number;
  fullName: string;
  phone?: string;
  specialization: 'nutritionist' | 'veterinarian';
  credentials?: string;
  profilePhoto?: string;
  profileCompletePercentage: number;
  createdAt: string;
  updatedAt: string;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('accessToken');
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new ApiError(response.status, error.message || error.error?.message);
  }
  
  return response.json();
}

export const api = {
  // Authentication
  async register(data: ConsultantRegistration) {
    return fetchWithAuth(`${API_BASE_URL}/jwt-auth/register/consultant`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async login(credentials: LoginCredentials): Promise<{ success: boolean; user: User; accessToken: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/jwt-auth/login`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    if (response.success && response.accessToken) {
      localStorage.setItem('accessToken', response.accessToken);
    }
    
    return response;
  },

  async logout() {
    const response = await fetchWithAuth(`${API_BASE_URL}/jwt-auth/logout`, {
      method: 'POST',
    });
    
    localStorage.removeItem('accessToken');
    return response;
  },

  async refreshToken() {
    return fetchWithAuth(`${API_BASE_URL}/jwt-auth/refresh`, {
      method: 'POST',
    });
  },

  async verifyEmail(token: string) {
    return fetchWithAuth(`${API_BASE_URL}/jwt-auth/verify-email`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async resendVerificationEmail(email: string) {
    return fetchWithAuth(`${API_BASE_URL}/jwt-auth/resend-verification`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Consultant Profile
  async getProfile(): Promise<{ success: boolean; profile: ConsultantProfile }> {
    return fetchWithAuth(`${API_BASE_URL}/consultant/profile`);
  },

  async updateProfile(data: Partial<ConsultantProfile>) {
    return fetchWithAuth(`${API_BASE_URL}/consultant/profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getDashboard() {
    return fetchWithAuth(`${API_BASE_URL}/consultant/dashboard`);
  },
};