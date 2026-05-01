import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  Session,
  Platform,
  GenerateStatus,
  Chunk,
  XhsContent,
  TwitterContent,
  Scene,
  TwitterMode,
  WechatPublishResult,
} from '../types';
import { singleToThread, threadToSingle } from '../twitter';

interface SessionsState {
  sessions: Record<string, Session>;
  order: string[];
  currentId: string | null;

  createSession(topic: string, platforms: Platform[]): Session;
  deleteSession(id: string): void;
  renameSession(id: string, title: string): void;
  setCurrentId(id: string | null): void;

  setStatus(id: string, p: Platform, status: GenerateStatus, error?: string): void;
  applyChunk(id: string, p: Platform, chunk: Chunk): void;
  setContent<P extends Platform>(id: string, p: P, content: NonNullable<Session['content'][P]>): void;
  setTwitterMode(id: string, mode: TwitterMode): void;
  setWechatPublishResult(id: string, result: WechatPublishResult): void;
}

function emptyStatus(platforms: Platform[]): Session['status'] {
  return Object.fromEntries(platforms.map(p => [p, 'pending'])) as Session['status'];
}

function updateSession(
  state: SessionsState,
  id: string,
  patch: (s: Session) => Session,
): Partial<SessionsState> {
  const existing = state.sessions[id];
  if (!existing) return {};
  return {
    sessions: { ...state.sessions, [id]: { ...patch(existing), updatedAt: Date.now() } },
  };
}

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      sessions: {},
      order: [],
      currentId: null,

      createSession: (topic, platforms) => {
        const id = nanoid(10);
        const now = Date.now();
        const session: Session = {
          id,
          topic,
          platforms,
          createdAt: now,
          updatedAt: now,
          content: {},
          status: emptyStatus(platforms),
        };
        set(state => ({
          sessions: { ...state.sessions, [id]: session },
          order: [id, ...state.order],
          currentId: id,
        }));
        return session;
      },

      deleteSession: (id) => {
        set(state => {
          const { [id]: _, ...rest } = state.sessions;
          return {
            sessions: rest,
            order: state.order.filter(x => x !== id),
            currentId: state.currentId === id ? null : state.currentId,
          };
        });
      },

      renameSession: (id, title) => {
        set(state => updateSession(state, id, s => ({ ...s, title })));
      },

      setCurrentId: (id) => set({ currentId: id }),

      setStatus: (id, p, status, error) => {
        set(state => updateSession(state, id, s => ({
          ...s,
          status: { ...s.status, [p]: status },
          error: error ? { ...s.error, [p]: error } : s.error,
        })));
      },

      applyChunk: (id, p, chunk) => {
        set(state => updateSession(state, id, s => applyChunkToSession(s, p, chunk)));
      },

      setContent: (id, p, content) => {
        set(state => updateSession(state, id, s => ({
          ...s,
          content: { ...s.content, [p]: content },
        })));
      },

      setTwitterMode: (id, mode) => {
        set(state => updateSession(state, id, s => {
          const tw = (s.content.twitter ?? { mode: 'single', single: '', thread: [] }) as TwitterContent;
          let next: TwitterContent = { ...tw, mode };

          if (mode === 'thread' && tw.thread.length === 0 && tw.single.trim()) {
            next = { ...next, thread: singleToThread(tw.single) };
          } else if (mode === 'single' && tw.single === '' && tw.thread.length > 0) {
            next = { ...next, single: threadToSingle(tw.thread) };
          }

          return { ...s, content: { ...s.content, twitter: next } };
        }));
      },

      setWechatPublishResult: (id, result) => {
        set(state => updateSession(state, id, s => ({
          ...s,
          publishResult: { ...s.publishResult, wechat: result },
        })));
      },
    }),
    {
      name: 'cf-sessions',
      partialize: (s) => ({ sessions: s.sessions, order: s.order }),
    },
  ),
);

function applyChunkToSession(s: Session, p: Platform, chunk: Chunk): Session {
  const content = { ...s.content };

  if (p === 'wechat') {
    if (chunk.kind === 'text') {
      content.wechat = (content.wechat ?? '') + chunk.value;
    }
    return { ...s, content };
  }

  if (p === 'xhs') {
    if (chunk.kind === 'init') {
      content.xhs = chunk.skeleton as XhsContent;
    } else if (chunk.kind === 'field' && content.xhs) {
      const xhs = content.xhs;
      if (chunk.field === 'tags') {
        content.xhs = { ...xhs, tags: chunk.value.split(',').map(t => t.trim()).filter(Boolean) };
      } else if (chunk.field === 'title' || chunk.field === 'body') {
        content.xhs = { ...xhs, [chunk.field]: (xhs[chunk.field] ?? '') + chunk.value };
      }
    }
    return { ...s, content };
  }

  if (p === 'twitter') {
    if (chunk.kind === 'init') {
      content.twitter = chunk.skeleton as TwitterContent;
    } else if (chunk.kind === 'field' && content.twitter) {
      const tw = content.twitter;
      if (chunk.field === 'single') {
        content.twitter = { ...tw, single: tw.single + chunk.value };
      } else if (chunk.field.startsWith('thread:')) {
        const tweetId = chunk.field.slice('thread:'.length);
        content.twitter = {
          ...tw,
          thread: tw.thread.map(t => t.id === tweetId ? { ...t, text: t.text + chunk.value } : t),
        };
      }
    }
    return { ...s, content };
  }

  if (p === 'video') {
    if (chunk.kind === 'init') {
      content.video = chunk.skeleton as Scene[];
    } else if (chunk.kind === 'field' && content.video) {
      const m = chunk.field.match(/^scene:([^:]+):(shot|voice)$/);
      if (m) {
        const [, sceneId, key] = m;
        content.video = content.video.map(sc =>
          sc.id === sceneId ? { ...sc, [key]: (sc[key as 'shot' | 'voice'] ?? '') + chunk.value } : sc,
        );
      }
    }
    return { ...s, content };
  }

  return s;
}
