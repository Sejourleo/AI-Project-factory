import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settings';
import { defaultSettings } from '../ai/mock-data';

beforeEach(() => {
  useSettingsStore.setState({ settings: defaultSettings });
  localStorage.clear();
});

describe('useSettingsStore', () => {
  it('初始值等于 defaultSettings', () => {
    expect(useSettingsStore.getState().settings).toEqual(defaultSettings);
  });

  it('patchPlatform 局部合并字段', () => {
    useSettingsStore.getState().patchPlatform('wechat', { systemPrompt: '新提示词' });
    const s = useSettingsStore.getState().settings;
    expect(s.wechat.systemPrompt).toBe('新提示词');
    expect(s.wechat.titleTemplate).toBe(defaultSettings.wechat.titleTemplate);
    expect(s.wechat.maxLength).toBe(defaultSettings.wechat.maxLength);
    expect(s.xhs).toEqual(defaultSettings.xhs);
  });

  it('patchPlatform 可一次改多个字段', () => {
    useSettingsStore.getState().patchPlatform('twitter', { titleTemplate: '观点：{topic}', maxLength: 5000 });
    const tw = useSettingsStore.getState().settings.twitter;
    expect(tw.titleTemplate).toBe('观点：{topic}');
    expect(tw.maxLength).toBe(5000);
    expect(tw.systemPrompt).toBe(defaultSettings.twitter.systemPrompt);
  });

  it('setPlatform 整体替换该平台', () => {
    const next = { systemPrompt: 'A', titleTemplate: 'B', maxLength: 100 };
    useSettingsStore.getState().setPlatform('xhs', next);
    expect(useSettingsStore.getState().settings.xhs).toEqual(next);
  });

  it('setAll 替换全部', () => {
    const next = {
      ...defaultSettings,
      wechat: { systemPrompt: 'X', titleTemplate: 'Y', maxLength: 1 },
    };
    useSettingsStore.getState().setAll(next);
    expect(useSettingsStore.getState().settings).toEqual(next);
  });

  it('resetPlatform 恢复默认', () => {
    useSettingsStore.getState().patchPlatform('wechat', { systemPrompt: '改过的' });
    useSettingsStore.getState().resetPlatform('wechat');
    expect(useSettingsStore.getState().settings.wechat).toEqual(defaultSettings.wechat);
  });

  it('resetAll 整体恢复', () => {
    useSettingsStore.getState().patchPlatform('wechat', { systemPrompt: 'X' });
    useSettingsStore.getState().patchPlatform('xhs', { systemPrompt: 'Y' });
    useSettingsStore.getState().resetAll();
    expect(useSettingsStore.getState().settings).toEqual(defaultSettings);
  });
});
