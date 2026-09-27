import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, PermissionKey, Church } from '../types/index.js';
import {
  api,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  getCachedChurchData,
  setCachedChurchData,
  setActiveChurchId,
} from '../services/api.js';

interface AuthContextType {
  user: User | null;
  church: Church | null;
  loading: boolean;
  login: (username: string, password: string, portal?: 'church' | 'super_admin') => Promise<void>;
  loginWithToken: (token: string, user: User, church?: Church | null) => void;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => void;
  setChurch: (church: Church | null) => void;
  hasPermission: (permission: PermissionKey) => boolean;
  canAccessService: (serviceId?: string) => boolean;
  isSuperAdmin: boolean;
  isChurchAdmin: boolean;
  isPriest: boolean;
  isGeneralSecretary: boolean;
  isStageCoordinator: boolean;
  isServant: boolean;
  isCaptain: boolean;
  isViewer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [church, setChurchState] = useState<Church | null>(() => getCachedChurchData<Church>());
  const [loading, setLoading] = useState<boolean>(true);

  const setChurch = useCallback((newChurch: Church | null) => {
    setChurchState(newChurch);
    setCachedChurchData(newChurch);
    setActiveChurchId(newChurch?.id || null);
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setChurchState(null);
      setCachedChurchData(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.get<{ user: User; church?: Church | null }>('/api/auth/me');
      setUser(data.user);
      if (data.church) {
        setChurchState(data.church);
        setCachedChurchData(data.church);
      } else if (data.user?.church_id) {
        // In case user belongs to a specific church but church object was omitted
        setChurchState(null);
        setCachedChurchData(null);
      }
    } catch (err) {
      console.warn('Authentication token expired or invalid');
      clearAuthToken();
      setUser(null);
      setChurchState(null);
      setCachedChurchData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (username: string, password: string, portal: 'church' | 'super_admin' = 'church'): Promise<void> => {
    const data = await api.post<{ success: boolean; token: string; user: User; church?: Church | null }>(
      '/api/auth/login',
      {
        username,
        password,
        portal,
      }
    );
    setAuthToken(data.token);
    setUser(data.user);
    if (data.church) {
      setChurchState(data.church);
      setCachedChurchData(data.church);
      setActiveChurchId(data.church.id);
    } else {
      setChurchState(null);
      setCachedChurchData(null);
      setActiveChurchId(null);
    }
  };

  const loginWithToken = useCallback((token: string, newUser: User, newChurch?: Church | null) => {
    setAuthToken(token);
    setUser(newUser);
    if (newChurch) {
      setChurchState(newChurch);
      setCachedChurchData(newChurch);
      setActiveChurchId(newChurch.id);
    } else {
      setChurchState(null);
      setCachedChurchData(null);
      setActiveChurchId(null);
    }
  }, []);

  const logout = async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      clearAuthToken();
      setUser(null);
      setChurchState(null);
      setCachedChurchData(null);
      setActiveChurchId(null);
    }
  };

  const refreshUser = async (): Promise<void> => {
    await fetchCurrentUser();
  };

  const updateUser = useCallback((updatedUser: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updatedUser } : null));
  }, []);

  const hasPermission = useCallback(
    (permission: PermissionKey): boolean => {
      if (!user) return false;
      if (
        user.role === 'super_admin' ||
        user.role === 'church_admin' ||
        user.role === 'priest' ||
        user.permissions.includes('full_access')
      ) {
        return true;
      }
      return user.permissions.includes(permission);
    },
    [user]
  );

  const canAccessService = useCallback(
    (serviceId?: string): boolean => {
      if (!user) return false;
      if (
        user.role === 'super_admin' ||
        user.role === 'church_admin' ||
        user.role === 'priest' ||
        user.role === 'general_secretary' ||
        user.scope === 'all' ||
        !serviceId
      ) {
        return true;
      }
      return user.scope === serviceId;
    },
    [user]
  );

  const isSuperAdmin = user?.role === 'super_admin';
  const isChurchAdmin = user?.role === 'church_admin';
  const isPriest = user?.role === 'priest';
  const isGeneralSecretary = user?.role === 'general_secretary';
  const isStageCoordinator = user?.role === 'stage_coordinator';
  const isServant = user?.role === 'servant';
  const isCaptain = user?.role === 'captain';
  const isViewer = user?.role === 'viewer';

  return (
    <AuthContext.Provider
      value={{
        user,
        church,
        loading,
        login,
        loginWithToken,
        setUser,
        logout,
        refreshUser,
        updateUser,
        setChurch,
        hasPermission,
        canAccessService,
        isSuperAdmin,
        isChurchAdmin,
        isPriest,
        isGeneralSecretary,
        isStageCoordinator,
        isServant,
        isCaptain,
        isViewer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
