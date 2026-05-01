'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { useSessionsStore } from '@/lib/studio/store/sessions';

interface Props {
  sessionId: string;
}

const TOOLBAR = [
  { cmd: 'h1', label: 'H1' },
  { cmd: 'h2', label: 'H2' },
  { cmd: 'bold', label: 'B' },
  { cmd: 'italic', label: 'I' },
  { cmd: 'quote', label: '"' },
  { cmd: 'hr', label: '—' },
  { cmd: 'image', label: '🖼' },
] as const;

export function WechatEditor({ sessionId }: Props) {
  const html = useSessionsStore(s => s.sessions[sessionId]?.content.wechat ?? '');
  const setContent = useSessionsStore(s => s.setContent);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Placeholder.configure({ placeholder: '内容生成中…' }),
    ],
    content: html,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'ProseMirror prose prose-invert max-w-none font-serif text-base leading-7 min-h-[60vh] focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      setContent(sessionId, 'wechat', editor.getHTML());
    },
  });

  // 流式更新：当外部 html 变化（生成时 store 在 append）且与编辑器内当前不同，同步
  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return;  // 用户编辑中不打扰
    if (html !== editor.getHTML()) {
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [html, editor]);

  if (!editor) return <div className="text-sm text-[var(--color-muted)]">编辑器加载中…</div>;

  function insertImage() {
    if (!editor) return;
    const url = window.prompt('图片 URL（粘贴公网可访问的链接）');
    if (url === null) return;          // 取消
    const trimmed = url.trim();
    if (!trimmed) return;              // 空字符串不插入
    const alt = window.prompt('图片描述（可留空，作为 alt）') ?? '';
    editor.chain().focus().setImage({ src: trimmed, alt: alt.trim() }).run();
  }

  function run(cmd: typeof TOOLBAR[number]['cmd']) {
    if (!editor) return;
    const c = editor.chain().focus();
    switch (cmd) {
      case 'h1': c.toggleHeading({ level: 1 }).run(); break;
      case 'h2': c.toggleHeading({ level: 2 }).run(); break;
      case 'bold': c.toggleBold().run(); break;
      case 'italic': c.toggleItalic().run(); break;
      case 'quote': c.toggleBlockquote().run(); break;
      case 'hr': c.setHorizontalRule().run(); break;
      case 'image': insertImage(); break;
    }
  }

  return (
    <div className="rounded-xl bg-[var(--color-surface)] p-4 space-y-3">
      <div className="flex gap-1 pb-2 border-b border-[var(--color-border)]">
        {TOOLBAR.map(b => (
          <button
            key={b.cmd}
            type="button"
            onClick={() => run(b.cmd)}
            className="h-8 w-8 inline-flex items-center justify-center rounded text-sm font-mono
                       text-[var(--color-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-fg)]"
          >
            {b.label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
