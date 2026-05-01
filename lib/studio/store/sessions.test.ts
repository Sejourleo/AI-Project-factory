// lib/store/sessions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionsStore } from './sessions';

beforeEach(() => {
  // 重置 store 状态（zustand 不会在测试间自动重置）
  useSessionsStore.setState({ sessions: {}, order: [], currentId: null });
  localStorage.clear();
});

describe('createSession', () => {
  it('创建后 sessions/order 各有一条，状态全部 pending', () => {
    const session = useSessionsStore.getState().createSession('如何专注', ['wechat', 'twitter']);
    const state = useSessionsStore.getState();

    expect(state.order).toEqual([session.id]);
    expect(state.sessions[session.id]).toBeDefined();
    expect(state.sessions[session.id].topic).toBe('如何专注');
    expect(state.sessions[session.id].platforms).toEqual(['wechat', 'twitter']);
    expect(state.sessions[session.id].status).toEqual({
      wechat: 'pending',
      twitter: 'pending',
    });
  });

  it('创建多个时按倒序排在 order 前面', () => {
    const a = useSessionsStore.getState().createSession('A', ['wechat']);
    const b = useSessionsStore.getState().createSession('B', ['xhs']);
    expect(useSessionsStore.getState().order).toEqual([b.id, a.id]);
  });
});

describe('appendChunk', () => {
  it('wechat text chunk 追加到 content.wechat', () => {
    const s = useSessionsStore.getState().createSession('topic', ['wechat']);
    useSessionsStore.getState().applyChunk(s.id, 'wechat', { kind: 'text', value: '<p>Hi' });
    useSessionsStore.getState().applyChunk(s.id, 'wechat', { kind: 'text', value: '</p>' });
    expect(useSessionsStore.getState().sessions[s.id].content.wechat).toBe('<p>Hi</p>');
  });

  it('xhs init 写骨架，field append 到对应字段', () => {
    const s = useSessionsStore.getState().createSession('topic', ['xhs']);
    useSessionsStore.getState().applyChunk(s.id, 'xhs', {
      kind: 'init',
      skeleton: { title: '', body: '', tags: [], images: [{ emoji: '🌅', desc: '' }] },
    });
    useSessionsStore.getState().applyChunk(s.id, 'xhs', { kind: 'field', field: 'title', value: 'Hi' });
    useSessionsStore.getState().applyChunk(s.id, 'xhs', { kind: 'field', field: 'body', value: 'world' });
    useSessionsStore.getState().applyChunk(s.id, 'xhs', { kind: 'field', field: 'tags', value: 'a,b,c' });

    const xhs = useSessionsStore.getState().sessions[s.id].content.xhs!;
    expect(xhs.title).toBe('Hi');
    expect(xhs.body).toBe('world');
    expect(xhs.tags).toEqual(['a', 'b', 'c']);
    expect(xhs.images).toHaveLength(1);
  });

  it('twitter init 设置 mode 和骨架', () => {
    const s = useSessionsStore.getState().createSession('topic', ['twitter']);
    useSessionsStore.getState().applyChunk(s.id, 'twitter', {
      kind: 'init',
      mode: 'thread',
      skeleton: { mode: 'thread', single: '', thread: [{ id: 't1', text: '' }, { id: 't2', text: '' }] },
    });
    useSessionsStore.getState().applyChunk(s.id, 'twitter', { kind: 'field', field: 'thread:t1', value: 'first' });
    useSessionsStore.getState().applyChunk(s.id, 'twitter', { kind: 'field', field: 'thread:t2', value: 'second' });

    const tw = useSessionsStore.getState().sessions[s.id].content.twitter!;
    expect(tw.mode).toBe('thread');
    expect(tw.thread.map(t => t.text)).toEqual(['first', 'second']);
  });

  it('video init + 字段填充', () => {
    const s = useSessionsStore.getState().createSession('topic', ['video']);
    useSessionsStore.getState().applyChunk(s.id, 'video', {
      kind: 'init',
      skeleton: [
        { id: 'sc1', index: 1, time: '00:00-00:05', shot: '', voice: '' },
      ],
    });
    useSessionsStore.getState().applyChunk(s.id, 'video', { kind: 'field', field: 'scene:sc1:shot', value: 'open shot' });
    useSessionsStore.getState().applyChunk(s.id, 'video', { kind: 'field', field: 'scene:sc1:voice', value: 'hello' });
    const scenes = useSessionsStore.getState().sessions[s.id].content.video!;
    expect(scenes[0].shot).toBe('open shot');
    expect(scenes[0].voice).toBe('hello');
  });
});

describe('setStatus', () => {
  it('更新指定平台状态', () => {
    const s = useSessionsStore.getState().createSession('t', ['wechat', 'xhs']);
    useSessionsStore.getState().setStatus(s.id, 'wechat', 'streaming');
    expect(useSessionsStore.getState().sessions[s.id].status.wechat).toBe('streaming');
    expect(useSessionsStore.getState().sessions[s.id].status.xhs).toBe('pending');
  });

  it('error 状态记录 message', () => {
    const s = useSessionsStore.getState().createSession('t', ['wechat']);
    useSessionsStore.getState().setStatus(s.id, 'wechat', 'error', 'oops');
    expect(useSessionsStore.getState().sessions[s.id].status.wechat).toBe('error');
    expect(useSessionsStore.getState().sessions[s.id].error?.wechat).toBe('oops');
  });
});

describe('renameSession / deleteSession', () => {
  it('rename 写入 title', () => {
    const s = useSessionsStore.getState().createSession('topic', ['wechat']);
    useSessionsStore.getState().renameSession(s.id, '新名字');
    expect(useSessionsStore.getState().sessions[s.id].title).toBe('新名字');
  });

  it('delete 同时清掉 order', () => {
    const a = useSessionsStore.getState().createSession('A', ['wechat']);
    const b = useSessionsStore.getState().createSession('B', ['wechat']);
    useSessionsStore.getState().deleteSession(a.id);
    expect(useSessionsStore.getState().sessions[a.id]).toBeUndefined();
    expect(useSessionsStore.getState().order).toEqual([b.id]);
  });
});

describe('setTwitterMode 触发种子转换', () => {
  it('single → thread 首次切换：thread 为空时种子转换', () => {
    const s = useSessionsStore.getState().createSession('t', ['twitter']);
    useSessionsStore.setState(state => ({
      sessions: {
        ...state.sessions,
        [s.id]: {
          ...state.sessions[s.id],
          content: {
            twitter: {
              mode: 'single',
              single: '第一段。\n\n第二段。',
              thread: [],
            },
          },
        },
      },
    }));
    useSessionsStore.getState().setTwitterMode(s.id, 'thread');
    const tw = useSessionsStore.getState().sessions[s.id].content.twitter!;
    expect(tw.mode).toBe('thread');
    expect(tw.thread.length).toBeGreaterThanOrEqual(2);
  });

  it('thread → single 首次切换：single 为空时种子转换', () => {
    const s = useSessionsStore.getState().createSession('t', ['twitter']);
    useSessionsStore.setState(state => ({
      sessions: {
        ...state.sessions,
        [s.id]: {
          ...state.sessions[s.id],
          content: {
            twitter: {
              mode: 'thread',
              single: '',
              thread: [{ id: '1', text: 'A' }, { id: '2', text: 'B' }],
            },
          },
        },
      },
    }));
    useSessionsStore.getState().setTwitterMode(s.id, 'single');
    expect(useSessionsStore.getState().sessions[s.id].content.twitter!.single).toBe('A\n\nB');
  });

  it('目标侧已有内容时不覆盖', () => {
    const s = useSessionsStore.getState().createSession('t', ['twitter']);
    useSessionsStore.setState(state => ({
      sessions: {
        ...state.sessions,
        [s.id]: {
          ...state.sessions[s.id],
          content: {
            twitter: {
              mode: 'single',
              single: 'foo',
              thread: [{ id: '1', text: '已编辑过的 thread' }],
            },
          },
        },
      },
    }));
    useSessionsStore.getState().setTwitterMode(s.id, 'thread');
    expect(useSessionsStore.getState().sessions[s.id].content.twitter!.thread[0].text).toBe('已编辑过的 thread');
  });
});
