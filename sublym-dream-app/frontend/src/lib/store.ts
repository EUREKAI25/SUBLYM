import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ===========================================
// AUTH STORE
// ===========================================

interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  pendingAccessCodeId: string | null;
  pendingUserId: string | null;

  setToken: (token: string) => void;
  setUserId: (userId: string) => void;
  setPendingAccessCode: (accessCodeId: string) => void;
  setPendingUserId: (userId: string) => void;
  lock: () => void;
  unlock: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      isAuthenticated: false,
      isLocked: false,
      pendingAccessCodeId: null,
      pendingUserId: null,

      setToken: (token) => set({ token, isAuthenticated: true, isLocked: false }),
      setUserId: (userId) => set({ userId }),
      setPendingAccessCode: (accessCodeId) => set({ pendingAccessCodeId: accessCodeId }),
      setPendingUserId: (userId) => set({ pendingUserId: userId }),
      lock: () => set({ isLocked: true }),
      unlock: () => set({ isLocked: false }),
      logout: () => set({
        token: null,
        userId: null,
        isAuthenticated: false,
        isLocked: false,
        pendingAccessCodeId: null,
        pendingUserId: null,
      }),
    }),
    {
      name: 'sublym-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        userId: state.userId,
        isAuthenticated: state.isAuthenticated,
        isLocked: state.isLocked,
      }),
    }
  )
);

// ===========================================
// USER SETTINGS STORE
// ===========================================

interface UserSettings {
  navigationMode: 'scroll' | 'swipe';
  gestureSensitivity: number;
  useDreamTheme: boolean;
  themePreference: 'system' | 'light' | 'dark';
}

interface SettingsState extends UserSettings {
  setNavigationMode: (mode: 'scroll' | 'swipe') => void;
  setGestureSensitivity: (value: number) => void;
  setUseDreamTheme: (value: boolean) => void;
  setThemePreference: (pref: 'system' | 'light' | 'dark') => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      navigationMode: 'scroll',
      gestureSensitivity: 0.5,
      useDreamTheme: true,
      themePreference: 'system',

      setNavigationMode: (mode) => set({ navigationMode: mode }),
      setGestureSensitivity: (value) => set({ gestureSensitivity: value }),
      setUseDreamTheme: (value) => set({ useDreamTheme: value }),
      setThemePreference: (pref) => set({ themePreference: pref }),
      updateSettings: (settings) => set(settings),
    }),
    {
      name: 'sublym-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ===========================================
// VIEWER STORE
// ===========================================

interface ViewerState {
  currentDreamId: string | null;
  currentImageIndex: number;
  isBottomBarVisible: boolean;

  setCurrentDream: (dreamId: string) => void;
  setCurrentImageIndex: (index: number) => void;
  nextImage: (totalImages: number) => void;
  previousImage: (totalImages: number) => void;
  toggleBottomBar: () => void;
  showBottomBar: () => void;
  hideBottomBar: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  currentDreamId: null,
  currentImageIndex: 0,
  isBottomBarVisible: false,

  setCurrentDream: (dreamId) => set({ currentDreamId: dreamId, currentImageIndex: 0 }),
  setCurrentImageIndex: (index) => set({ currentImageIndex: index }),
  nextImage: (totalImages) =>
    set((state) => ({
      currentImageIndex: (state.currentImageIndex + 1) % totalImages,
    })),
  previousImage: (totalImages) =>
    set((state) => ({
      currentImageIndex: state.currentImageIndex === 0 ? totalImages - 1 : state.currentImageIndex - 1,
    })),
  toggleBottomBar: () => set((state) => ({ isBottomBarVisible: !state.isBottomBarVisible })),
  showBottomBar: () => set({ isBottomBarVisible: true }),
  hideBottomBar: () => set({ isBottomBarVisible: false }),
}));
