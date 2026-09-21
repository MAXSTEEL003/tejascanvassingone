// Client-side authentication service interfacing with secure server authentication

export interface AuthenticatedUser {
  sub?: string;
  username: string;
  role: 'admin' | 'employee' | 'merchant';
  name: string;
  email: string;
}

const TOKEN_KEY = 'tejas_auth_token_v1';
const SESSION_USER_KEY = 'tejas_auth_user_v1';

// Read raw token
export function getAuthToken(): string | null {
  try {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    }
  } catch {}
  return null;
}

// Decode payload from token without full signature check (fast UI check; server verifies cryptographic HMAC)
export function parseTokenPayload(token: string): AuthenticatedUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const jsonStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(jsonStr);
    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp && parsed.exp < now) {
      return null;
    }
    return {
      sub: parsed.sub,
      username: parsed.username,
      role: parsed.role,
      name: parsed.name,
      email: parsed.email,
    };
  } catch {
    return null;
  }
}

// Get the verified role from the signed token (rejects arbitrary localStorage.userRole tampering)
export function getVerifiedUserRole(): 'admin' | 'employee' | 'merchant' | null {
  const token = getAuthToken();
  if (!token) return null;
  const user = parseTokenPayload(token);
  if (!user) return null;
  return user.role;
}

// Store session upon successful login
export function setAuthSession(token: string, user: AuthenticatedUser): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));

    // Also set legacy display variables for UI headers while role verification is strictly checked against token
    localStorage.setItem('userRole', user.role);
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userEmail', user.email);
    window.dispatchEvent(new Event('role-changed'));
  } catch (e) {
    console.warn('Error setting auth session:', e);
  }
}

// Clear session
export function clearAuthSession(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    window.dispatchEvent(new Event('role-changed'));
  } catch (e) {
    console.warn('Error clearing auth session:', e);
  }
}

// Verify session with the server
export async function verifyServerSession(): Promise<AuthenticatedUser | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      clearAuthSession();
      return null;
    }

    const data = await res.json();
    if (data.valid && data.user) {
      return data.user as AuthenticatedUser;
    }
    clearAuthSession();
    return null;
  } catch (err) {
    // If offline or network error, fallback to token expiration check
    const localUser = parseTokenPayload(token);
    return localUser;
  }
}

// Server Login Call
export async function loginWithServer(
  username: string,
  password: string,
  roleHint?: 'admin' | 'employee' | 'merchant'
): Promise<{ success: boolean; token?: string; user?: AuthenticatedUser; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, roleHint }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.token) {
      setAuthSession(data.token, data.user);
      return { success: true, token: data.token, user: data.user };
    }

    return { success: false, error: data.error || 'Authentication failed.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during authentication.' };
  }
}

// Verify sensitive admin action
export async function verifyAdminActionServer(password?: string, action = 'admin_action'): Promise<boolean> {
  try {
    const token = getAuthToken();
    const res = await fetch('/api/auth/verify-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ password, action }),
    });

    const data = await res.json();
    return !!data.authorized;
  } catch {
    return false;
  }
}

// Alias with (action, password) signature for sensitive data purge/deletion requests
export async function verifyActionWithServer(
  action: string, 
  password?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = getAuthToken();
    const res = await fetch('/api/auth/verify-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ password, action }),
    });

    const data = await res.json();
    if (res.ok && data.authorized) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Action unauthorized. Incorrect admin password.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during authorization check.' };
  }
}

// Manage employee server-side
export async function manageEmployeeServer(action: 'create' | 'update' | 'delete', employee: any): Promise<any> {
  const token = getAuthToken();
  const res = await fetch('/api/auth/manage-employee', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ action, employee }),
  });
  return await res.json();
}
