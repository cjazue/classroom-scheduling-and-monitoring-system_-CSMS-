/* CSMS frontend integration (static HTML + Flask API)
 *
 * Exposes `window.CSMS`:
 * - CSMS.api.request(path, opts)
 * - CSMS.auth.login(email, password)
 * - CSMS.auth.logout()
 * - CSMS.auth.me()
 * - CSMS.auth.updateMe(patch)
 * - CSMS.auth.getUser() / setUser()
 *
 * Also auto-initializes:
 * - role-based route guarding by URL prefix
 * - login page wiring (/auth/loginpage.html)
 * - logout wiring (any Logout/Log out link/button)
 */

(function () {
  'use strict';

  const STORAGE = {
    access: 'csms.access_token',
    refresh: 'csms.refresh_token',
    user: 'csms.user',
    apiBase: 'csms.api_base',
  };

  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function getApiBase() {
    const fromWindow = typeof window.CSMS_API_BASE === 'string' ? window.CSMS_API_BASE : '';
    const fromStorage = (localStorage.getItem(STORAGE.apiBase) || '').trim();
    return (fromStorage || fromWindow || '').replace(/\/+$/, '');
  }

  function getAccessToken() {
    return (localStorage.getItem(STORAGE.access) || '').trim() || null;
  }

  function getRefreshToken() {
    return (localStorage.getItem(STORAGE.refresh) || '').trim() || null;
  }

  function setTokens(accessToken, refreshToken) {
    if (accessToken) localStorage.setItem(STORAGE.access, accessToken);
    if (refreshToken) localStorage.setItem(STORAGE.refresh, refreshToken);
  }

  function clearTokens() {
    localStorage.removeItem(STORAGE.access);
    localStorage.removeItem(STORAGE.refresh);
    localStorage.removeItem(STORAGE.user);
  }

  function getUser() {
    const raw = localStorage.getItem(STORAGE.user);
    return raw ? safeJsonParse(raw) : null;
  }

  function setUser(user) {
    if (!user) {
      localStorage.removeItem(STORAGE.user);
      return;
    }
    localStorage.setItem(STORAGE.user, JSON.stringify(user));
  }

  async function parseResponseBody(res) {
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      try {
        return await res.json();
      } catch {
        return null;
      }
    }
    try {
      return await res.text();
    } catch {
      return null;
    }
  }

  function buildError(res, body) {
    let message = 'Request failed';
    if (body && typeof body === 'object') {
      message = body.error || body.message || message;
      // Surface backend field-level validation messages when available.
      if (body.errors && typeof body.errors === 'object') {
        const keys = Object.keys(body.errors);
        if (keys.length) {
          const raw = body.errors[keys[0]];
          const detail = Array.isArray(raw) ? raw[0] : raw;
          if (typeof detail === 'string' && detail.trim()) {
            message = message.toLowerCase().includes('validation') ? detail.trim() : `${message} (${detail.trim()})`;
          }
        }
      }
    } else if (typeof body === 'string' && body.trim()) {
      message = body.trim();
    } else if (res && res.statusText) {
      message = res.statusText;
    }
    const err = new Error(message);
    err.status = res ? res.status : 0;
    err.body = body;
    return err;
  }

  async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    const base = getApiBase();
    const res = await fetch(base + '/api/auth/refresh', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    const body = await parseResponseBody(res);
    if (!res.ok || !body || body.success !== true) return false;

    const accessToken = body.data && body.data.access_token;
    if (!accessToken) return false;
    setTokens(accessToken, null);
    return true;
  }

  async function request(path, opts) {
    const options = opts || {};
    const method = (options.method || 'GET').toUpperCase();
    const auth = options.auth !== false;
    const retryOn401 = options.retryOn401 !== false;

    const base = getApiBase();
    const url = path.startsWith('http://') || path.startsWith('https://') ? path : base + path;

    const headers = Object.assign({ Accept: 'application/json' }, options.headers || {});

    const body =
      options.body && typeof options.body === 'object' && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body;

    if (body && typeof body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (auth) {
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body,
    });

    if (res.status === 401 && retryOn401 && path !== '/api/auth/refresh') {
      const didRefresh = await refreshAccessToken();
      if (didRefresh) {
        return request(path, Object.assign({}, options, { retryOn401: false }));
      }
    }

    const data = await parseResponseBody(res);

    if (!res.ok) throw buildError(res, data);
    if (data && typeof data === 'object' && data.success === false) throw buildError(res, data);
    return data;
  }

  const CSMS = {
    storage: STORAGE,
    api: { request },
    auth: {
      isLoggedIn() {
        return !!getAccessToken() && !!getRefreshToken();
      },
      getAccessToken,
      getRefreshToken,
      getUser,
      setUser,
      async login(email, password) {
        const body = await request('/api/auth/login', {
          method: 'POST',
          auth: false,
          body: { email, password },
        });
        const payload = body && body.data ? body.data : null;
        if (!payload || !payload.access_token || !payload.refresh_token || !payload.user) {
          throw new Error('Login failed: unexpected response');
        }
        setTokens(payload.access_token, payload.refresh_token);
        setUser(payload.user);
        return payload.user;
      },
      async logout() {
        try {
          await request('/api/auth/logout', { method: 'POST' });
        } catch {
          // Ignore server-side failures; clear local state anyway.
        } finally {
          clearTokens();
        }
      },
      async me() {
        const body = await request('/api/auth/me', { method: 'GET' });
        const user = body && body.data ? body.data : null;
        if (user) setUser(user);
        return user;
      },
      async updateMe(patch) {
        const body = await request('/api/auth/me', { method: 'PATCH', body: patch });
        const user = body && body.data ? body.data : null;
        if (user) setUser(user);
        return user;
      },
      async ensureUser() {
        const cached = getUser();
        if (cached && cached.role) return cached;
        try {
          return await CSMS.auth.me();
        } catch {
          return cached;
        }
      },
    },
    paths: {
      login: '/auth/loginpage.html',
      landing: '/auth/homepage.html',
      forRole(role) {
        switch ((role || '').toLowerCase()) {
          case 'superadmin':
            return '/superadmin/Super Admin.html';
          case 'admin':
            return '/admin/home.html';
          case 'authorized_user':
            return '/auth/dashboard.html';
          case 'student':
            return '/user/home.html';
          default:
            return '/auth/homepage.html';
        }
      },
    },
    ui: {
      toast(message) {
        // Minimal, non-invasive.
        alert(message);
      },
    },
  };

  window.CSMS = CSMS;

  function normalizePath(p) {
    try {
      return decodeURIComponent(p || '').toLowerCase();
    } catch {
      return (p || '').toLowerCase();
    }
  }

  function isPublicPage(pathname) {
    const p = normalizePath(pathname);
    if (p === '/' || p === '/index.html') return true;
    if (p.startsWith('/auth/')) {
      return (
        p.endsWith('/loginpage.html') ||
        p.endsWith('/homepage.html') ||
        p.endsWith('/about us.html')
      );
    }
    return false;
  }

  function requiredRolesForPath(pathname) {
    const p = normalizePath(pathname);
    if (p.startsWith('/superadmin/')) return ['superadmin'];
    if (p.startsWith('/admin/')) return ['admin', 'superadmin'];
    if (p.startsWith('/user/')) return ['student'];
    if (p.startsWith('/auth/')) return ['authorized_user'];
    return null;
  }

  function redirectTo(path) {
    window.location.href = encodeURI(path);
  }

  async function guardRoutes() {
    const pathname = window.location.pathname || '/';

    if (isPublicPage(pathname)) {
      // If already logged in, skip login/landing.
      const p = normalizePath(pathname);
      if ((p.endsWith('/loginpage.html') || p.endsWith('/homepage.html')) && CSMS.auth.isLoggedIn()) {
        const user = await CSMS.auth.ensureUser();
        if (user && user.role) redirectTo(CSMS.paths.forRole(user.role));
      }
      return;
    }

    const required = requiredRolesForPath(pathname);
    if (!required) return;

    if (!CSMS.auth.isLoggedIn()) {
      redirectTo(CSMS.paths.login);
      return;
    }

    const user = await CSMS.auth.ensureUser();
    if (!user || !user.role) {
      // Token might be invalid; force re-login.
      clearTokens();
      redirectTo(CSMS.paths.login);
      return;
    }

    if (!required.includes(user.role)) {
      redirectTo(CSMS.paths.forRole(user.role));
    }
  }

  function wireLogout() {
    const candidates = [];
    document.querySelectorAll('a, button').forEach((el) => {
      const text = (el.textContent || '').trim().toLowerCase();
      const href = el.tagName === 'A' ? (el.getAttribute('href') || '') : '';

      const looksLikeLogout =
        text === 'logout' ||
        text === 'log out' ||
        el.classList.contains('logout-btn') ||
        /homepage\.html$/i.test(href);

      if (looksLikeLogout) candidates.push(el);
    });

    candidates.forEach((el) => {
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        await CSMS.auth.logout();
        redirectTo(CSMS.paths.landing);
      });
    });
  }

  function wireLoginPage() {
    const p = normalizePath(window.location.pathname);
    if (!p.endsWith('/auth/loginpage.html')) return;

    const form = document.querySelector('form');
    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');
    const button = document.querySelector('.submit-btn') || document.querySelector('button');

    async function doLogin() {
      const email = (emailInput && emailInput.value ? emailInput.value : '').trim().toLowerCase();
      const password = passwordInput && passwordInput.value ? passwordInput.value : '';

      if (!email || !password) {
        CSMS.ui.toast('Email and password are required.');
        return;
      }

      try {
        const user = await CSMS.auth.login(email, password);
        redirectTo(CSMS.paths.forRole(user.role));
      } catch (err) {
        CSMS.ui.toast(err && err.message ? err.message : 'Login failed.');
      }
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        doLogin();
      });
    }

    if (button) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        doLogin();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Order matters: route guard first so protected pages bounce early.
    guardRoutes();
    wireLogout();
    wireLoginPage();
  });
})();
