import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, login as apiLogin, logout as apiLogout, changePassword as apiChangePassword } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((data) => {
        setUser(data.user || data);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setToken(null);
    setUser(null);
  }, []);

  const changePassword = useCallback(async (newPassword) => {
    const data = await apiChangePassword(newPassword);
    if (user) {
      setUser({ ...user, force_password_change: false });
    }
    return data;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, changePassword, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
