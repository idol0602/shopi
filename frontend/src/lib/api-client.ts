/**
 * Production-grade Client API Interceptor for Shopi Marketplace
 *
 * Features:
 * - Transparent silent token refresh on HTTP 401 Unauthorized
 * - Request queueing to prevent multiple concurrent refresh calls (Race condition prevention)
 * - Automatic retry of failed requests with fresh Access Token
 * - Type-safe methods (get, post, put, patch, delete)
 * - Credentials included for HttpOnly Refresh Token cookie transport
 */

export interface RequestOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  skipAuth?: boolean;
  retryCount?: number;
}

interface QueuedRequest {
  resolve: (value: Response) => void;
  reject: (reason?: unknown) => void;
  retry: () => Promise<Response>;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private isRefreshing: boolean = false;
  private failedQueue: QueuedRequest[] = [];

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      (typeof window !== "undefined"
        ? process.env.NEXT_PUBLIC_API_GATEWAY_URL || ""
        : process.env.API_GATEWAY_INTERNAL_URL || "http://api-gateway:8080");
  }

  /**
   * Set or update in-memory Access Token
   */
  public setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /**
   * Get current in-memory Access Token
   */
  public getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Process all queued requests waiting for token refresh
   */
  private processQueue(error: Error | null): void {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.retry().then(prom.resolve).catch(prom.reject);
      }
    });
    this.failedQueue = [];
  }

  /**
   * Silently refresh Access Token via HttpOnly cookie endpoint
   */
  private async refreshAccessToken(): Promise<string> {
    const refreshUrl = `${this.baseUrl}/api/auth/refresh`;

    const response = await fetch(refreshUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Send HttpOnly refresh_token cookie
    });

    if (!response.ok) {
      this.accessToken = null;
      throw new Error(`Token refresh failed with status ${response.status}`);
    }

    const data = await response.json();
    const newAccessToken = data.accessToken || data.access_token;

    if (!newAccessToken) {
      throw new Error("No access token returned from refresh endpoint");
    }

    this.accessToken = newAccessToken;
    return newAccessToken;
  }

  /**
   * Main request method with 401 interception & silent token refresh
   */
  public async request(endpoint: string, options: RequestOptions = {}): Promise<Response> {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    };

    if (this.accessToken && !options.skipAuth) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const fetchConfig: RequestInit = {
      ...options,
      headers,
      credentials: "include",
    };

    try {
      const response = await fetch(url, fetchConfig);

      // Intercept 401 Unauthorized
      if (response.status === 401 && !options.skipAuth) {
        // Prevent infinite loops if retry fails
        if ((options.retryCount || 0) >= 1) {
          return response;
        }

        // If a refresh is already in flight, queue this request
        if (this.isRefreshing) {
          return new Promise<Response>((resolve, reject) => {
            this.failedQueue.push({
              resolve,
              reject,
              retry: () =>
                this.request(endpoint, {
                  ...options,
                  retryCount: (options.retryCount || 0) + 1,
                }),
            });
          });
        }

        this.isRefreshing = true;

        try {
          const freshToken = await this.refreshAccessToken();
          this.processQueue(null);

          // Retry the original request with new token
          headers["Authorization"] = `Bearer ${freshToken}`;
          return await fetch(url, {
            ...fetchConfig,
            headers,
          });
        } catch (refreshError) {
          const err =
            refreshError instanceof Error
              ? refreshError
              : new Error("Session expired. Please log in again.");

          this.processQueue(err);

          // In browser context, emit auth-expired event or handle redirect
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("shopi:auth-expired", { detail: { error: err } })
            );
          }

          return response;
        } finally {
          this.isRefreshing = false;
        }
      }

      return response;
    } catch (networkError) {
      throw networkError;
    }
  }

  /**
   * Helper GET method
   */
  public async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.request(endpoint, { ...options, method: "GET" });
    if (!response.ok) {
      throw new Error(`API GET ${endpoint} failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Helper POST method
   */
  public async post<T>(
    endpoint: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<T> {
    const response = await this.request(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `API POST ${endpoint} failed: ${response.status} - ${errorBody || response.statusText}`
      );
    }
    return response.json();
  }

  /**
   * Helper PUT method
   */
  public async put<T>(
    endpoint: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<T> {
    const response = await this.request(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`API PUT ${endpoint} failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Helper PATCH method
   */
  public async patch<T>(
    endpoint: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<T> {
    const response = await this.request(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`API PATCH ${endpoint} failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Helper DELETE method
   */
  public async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.request(endpoint, { ...options, method: "DELETE" });
    if (!response.ok) {
      throw new Error(`API DELETE ${endpoint} failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// ==========================================
// Auth API Types & Functions
// ==========================================

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  userId: string;
  email: string;
  role: string;
  fullName: string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  verificationToken: string;
}

export interface GoogleLoginParams {
  idToken?: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
}

export async function sendOtp(email: string): Promise<SendOtpResponse> {
  return apiClient.post<SendOtpResponse>("/api/auth/register/send-otp", { email }, { skipAuth: true });
}

export async function verifyOtp(email: string, otpCode: string): Promise<VerifyOtpResponse> {
  return apiClient.post<VerifyOtpResponse>("/api/auth/register/verify-otp", { email, otpCode }, { skipAuth: true });
}

export async function registerWithEmail(
  email: string,
  password: string,
  fullName: string,
  verificationToken: string
): Promise<LoginResponse> {
  const data = await apiClient.post<LoginResponse>(
    "/api/auth/register/email",
    { email, password, fullName, verificationToken },
    { skipAuth: true }
  );
  if (data?.accessToken) {
    apiClient.setAccessToken(data.accessToken);
  }
  return data;
}

export async function loginWithGoogle(params: GoogleLoginParams): Promise<LoginResponse> {
  const data = await apiClient.post<LoginResponse>("/api/auth/google", params, { skipAuth: true });
  if (data?.accessToken) {
    apiClient.setAccessToken(data.accessToken);
  }
  return data;
}

export async function loginWithEmail(email: string, password: string): Promise<LoginResponse> {
  const data = await apiClient.post<LoginResponse>(
    "/api/auth/login",
    { email, password },
    { skipAuth: true }
  );
  if (data?.accessToken) {
    apiClient.setAccessToken(data.accessToken);
  }
  return data;
}

