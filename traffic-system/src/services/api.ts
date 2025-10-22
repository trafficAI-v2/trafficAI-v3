// src/services/api.ts - API 服務統一封裝

// API 的基本 URL，從 .env 檔案讀取，並提供一個開發時的預設值
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';

/**
 * 一個專門用來處理 API 請求的服務類別
 */
class ApiService {
  
  /**
   * 通用的私有請求方法，是所有請求的核心
   * @param endpoint API 的路徑 (例如 /api/login)
   * @param options fetch 的設定物件
   * @returns Promise<T> 回傳一個 Promise，其解析後的值會是 API 回應的資料
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // 準備預設的 headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    // 檢查 localStorage 中是否有 accessToken
    const token = localStorage.getItem('accessToken');
    if (token) {
      // 如果有，就自動將它加入到 Authorization 標頭中
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      // 處理 HTTP 錯誤狀態碼
      if (!response.ok) {
        // 如果是 401 (未授權)，通常代表 token 過期或無效
        if (response.status === 401) {
          // 清除本地儲存的 token
          localStorage.removeItem('accessToken');
          // 強制重新整理並跳轉到登入頁
          window.location.href = '/login';
          // 拋出一個明確的錯誤，中斷後續的程式碼執行
          throw new Error('登入憑證已過期或無效，請重新登入。');
        }
        // 對於其他錯誤，嘗試解析後端回傳的錯誤訊息
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP 錯誤: ${response.status}`);
      }

      // 如果請求成功，解析 JSON 資料並回傳
      return response.json();

    } catch (error) {
      console.error('API 請求失敗:', endpoint, error);
      // 將錯誤向上拋出，讓呼叫它的地方可以進行處理
      throw error;
    }
  }

  // --- 提供給外部使用的公開方法 ---

  public get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // --- 你也可以在這裡加入更具體的業務邏輯函式 ---
  // 例如：
  // async login(username: string, password: string): Promise<{ access_token: string }> {
  //   return this.post<{ access_token: string }>('/api/login', { username, password });
  // }
}

// 建立並匯出 ApiService 的「單例 (Singleton)」，確保整個應用程式共用同一個實例
export const apiService = new ApiService();