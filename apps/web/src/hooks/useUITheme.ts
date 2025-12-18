import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UITheme = 'default' | 'dark';

interface UIThemeStore {
    theme: UITheme;
    setTheme: (theme: UITheme) => void;
}

const THEME_STORAGE_KEY = 'wemd-ui-theme';

const FAVICON_MAP: Record<UITheme, string> = {
    default: 'favicon-dark.svg',
    dark: 'favicon-dark.svg',
};

const resolveAssetHref = (filename: string) => {
    if (typeof document === 'undefined') return filename;
    return new URL(filename, document.baseURI).toString();
};

const applyThemeSideEffects = (theme: UITheme) => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-ui-theme', theme);
    const faviconEl = document.querySelector<HTMLLinkElement>("link[rel='icon'], link[rel='shortcut icon']");
    if (faviconEl) {
        const file = FAVICON_MAP[theme] ?? FAVICON_MAP.default;
        faviconEl.href = resolveAssetHref(file);
    }
};

const hydrateThemeFromStorage = (): UITheme => {
    if (typeof window === 'undefined') return 'default';
    try {
        const stored = window.localStorage?.getItem(THEME_STORAGE_KEY);
        // 兼容旧值 structuralism 迁移到 dark
        if (stored === 'structuralism') {
            applyThemeSideEffects('dark');
            return 'dark';
        }
        if (stored === 'default' || stored === 'dark') {
            applyThemeSideEffects(stored);
            return stored;
        }
    } catch {
        /* ignore hydration errors */
    }
    applyThemeSideEffects('default');
    return 'default';
};

const initialTheme = hydrateThemeFromStorage();

export const useUITheme = create<UIThemeStore>()(
    persist(
        (set) => ({
            theme: initialTheme,
            setTheme: (theme) => {
                set({ theme });
                applyThemeSideEffects(theme);
            },
        }),
        {
            name: THEME_STORAGE_KEY,
            onRehydrateStorage: () => (state) => {
                if (state) {
                    applyThemeSideEffects(state.theme);
                }
            },
        }
    )
);
