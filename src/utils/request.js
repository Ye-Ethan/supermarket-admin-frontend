import axios from 'axios'
import { ElMessage } from "element-plus";
import router from '@/router/index.js';

// 定义 Token 的 Key，方便管理
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// 创建axios实例
const service = axios.create({
    baseURL: "http://localhost:8080",
    timeout: 5000,
    withCredentials: true 
})

// ==========================================
// 核心变量：防止并发刷新 & 请求队列
// ==========================================
let isRefreshing = false; // 是否正在刷新 Token
let requestsQueue = [];   // 存储刷新期间被阻断的请求

// 辅助函数：执行队列中的请求
const processQueue = (error, token = null) => {
    requestsQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    requestsQueue = [];
};

// ==========================================
// 请求拦截器
// ==========================================
service.interceptors.request.use(
    config => {
        // 每次请求都尝试带上 Access Token
        const token = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
)

// ==========================================
// 响应拦截器
// ==========================================
service.interceptors.response.use(
    response => {
        const res = response.data;
        
        // 兼容处理：有的后端喜欢用 200 状态码返回业务错误
        // 如果你的后端 Token 过期是返回 HTTP 401，这里主要处理业务逻辑
        if (res.code) {
            switch (res.code) {
                case 200:
                    // 只有这里可以不弹窗，或者根据 method 判断是否弹窗
                    // ElMessage.success(res.msg || 'Success'); 
                    return res; 
                case 401: 
                    // 业务层面的权限不足 (如普通用户访问管理员接口)
                    ElMessage.error(res.msg || '用户权限不足');
                    return Promise.reject(res);
                case 403:
                    // 业务层面的未登录 (如果你后端 Token 过期返回的是 HTTP 200 + code 403，逻辑要写在这里)
                    // 但建议 Token 过期走 HTTP 401 (下面 error 里的逻辑)
                    handleLogout();
                    break;
                case 500:
                    ElMessage.error(res.msg || '服务器错误');
                    return Promise.reject(res);
                default:
                    ElMessage.error(res.msg || '未知错误');
                    return Promise.reject(res);
            }
        }
        return res;
    },
    async error => {
        const originalRequest = error.config;

        // ==========================================
        // 核心逻辑：捕获 HTTP 401 (Token 过期)
        // ==========================================
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            
            // 如果是刷新 Token 的接口本身报错了 (Refresh Token 也过期了)
            // 防止死循环，直接登出
            if (originalRequest.url.includes('/auth/refresh')) {
                handleLogout();
                return Promise.reject(error);
            }

            // 1. 如果正在刷新，将当前请求加入队列
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    requestsQueue.push({ resolve, reject });
                }).then(token => {
                    // 队列被释放后，带着新 Token 重试请求
                    originalRequest.headers['Authorization'] = `Bearer ${token}`;
                    return service(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            // 2. 开始刷新 Token
            originalRequest._retry = true; // 标记该请求已经重试过一次
            isRefreshing = true;

            try {
                // 发起刷新请求 (注意：这里最好用一个新的 axios 实例或者 fetch，避免拦截器干扰，或者后端允许 refresh 接口不带 Access Token)
                const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
                
                if (!refreshToken) {
                    throw new Error('No refresh token available');
                }

                // 假设刷新接口是 /auth/refresh，参数带上 refreshToken
                // 注意：这里使用的是 axios.post 而不是 service.post，防止无限循环拦截
                const { data } = await axios.post('http://localhost:8080/auth/refresh', {
                    refreshToken: refreshToken 
                });

                if (data.code === 200) {
                    // 3. 刷新成功，更新本地存储
                    const newAccessToken = data.data.access_token; // 根据你后端的实际返回结构修改
                    // 如果后端也返回了新的 refresh token，也要更新
                    // const newRefreshToken = data.data.refresh_token; 
                    
                    localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
                    // localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

                    // 4. 处理队列：告诉队列里等待的请求“Token 好了，去重试吧”
                    processQueue(null, newAccessToken);

                    // 5. 重试当前错误的请求
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    return service(originalRequest);
                } else {
                    // 刷新接口返回了业务错误
                    throw new Error(data.msg || 'Refresh failed');
                }

            } catch (refreshError) {
                // 6. 刷新失败 (Refresh Token 也过期了，或者被废弃)
                processQueue(refreshError, null);
                handleLogout(); // 强制登出
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false; // 解除锁
            }
        }

        if(error.response && error.response.status === 403) {
            // HTTP 403 处理 (未登录)
            handleLogout();
            return Promise.reject(error);
        }
        if(error.response && error.response.message) {
            ElMessage.error(error.response.message);
        }

        // 处理其他 HTTP 错误
        ElMessage.error(error.message || '网络请求错误');
        return Promise.reject(error);
    }
)

/**
 * 统一的登出处理
 */
function handleLogout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    ElMessage.error('登录已过期，请重新登录');
    
    router.push({
        path: '/auth/login',
        query: {
            redirectTo: router.currentRoute.value.fullPath // 登录后跳回当前页面
        }
    });
}

// ==========================================
// 封装的方法 (保留你原有的)
// ==========================================

export function get(url, params = {}) {
    return service.get(url, { params });
}

export function post(url, data = {}) {
    return service.post(url, data);
}

export function put(url, data = {}) {
    return service.put(url, data);
}

export function del(url, data = {}) {
    return service.delete(url, { data });
}

export default service;