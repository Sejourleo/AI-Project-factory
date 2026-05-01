import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Platform, PlatformSettings, Settings } from '../types';
import { defaultSettings } from '../ai/mock-data';

interface SettingsState {
  settings: Settings;
  patchPlatform(p: Platform, patch: Partial<PlatformSettings>): void;
  setPlatform(p: Platform, value: PlatformSettings): void;
  setAll(value: Settings): void;
  resetPlatform(p: Platform): void;
  resetAll(): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      patchPlatform: (p, patch) => set(state => ({
        settings: { ...state.settings, [p]: { ...state.settings[p], ...patch } },
      })),
      setPlatform: (p, value) => set(state => ({
        settings: { ...state.settings, [p]: value },
      })),
      setAll: (value) => set({ settings: value }),
      resetPlatform: (p) => set(state => ({
        settings: { ...state.settings, [p]: defaultSettings[p] },
      })),
      resetAll: () => set({ settings: defaultSettings }),
    }),
    {
      name: 'cf-settings',
      version: 2,
      migrate: (persisted: unknown) => {
        // v1 → v2：把旧的 styleGuide+outputFormat 合并为 systemPrompt，补齐新字段
        const root = persisted as { settings?: Record<string, Record<string, unknown>> } | null;
        if (!root || !root.settings) return root;
        const next: Record<string, PlatformSettings> = {};
        for (const [p, val] of Object.entries(root.settings)) {
          if (val && typeof val === 'object' && 'systemPrompt' in val) {
            // 已是新结构
            next[p] = val as unknown as PlatformSettings;
            continue;
          }
          const styleGuide = (val?.styleGuide as string | undefined) ?? '';
          const outputFormat = (val?.outputFormat as string | undefined) ?? '';
          const platformKey = p as Platform;
          next[p] = {
            systemPrompt: [styleGuide, outputFormat].filter(Boolean).join('\n\n')
              || defaultSettings[platformKey].systemPrompt,
            titleTemplate: defaultSettings[platformKey].titleTemplate,
            maxLength: defaultSettings[platformKey].maxLength,
          };
        }
        return { settings: next };
      },
    },
  ),
);
