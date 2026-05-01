// 公众号发布相关的纯函数：标题提取 / HTML→newspic markdown / 图片计数

const TITLE_MAX = 64;

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

/**
 * 取首个 <h1> 文本（去内嵌标签 + 实体解码 + 前后 trim + 64 字截断）。
 * 没有 h1 则返回空字符串。
 */
export function extractWechatTitle(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return '';
  const text = decodeEntities(stripTags(m[1])).trim();
  return text.slice(0, TITLE_MAX);
}

/**
 * 统计 HTML 中带非空 src 的 <img> 数量（占位空 src 不算）。
 */
export function countWechatImages(html: string): number {
  const matches = html.matchAll(/<img\b[^>]*\bsrc\s*=\s*(['"])([^'"]*)\1/gi);
  let count = 0;
  for (const m of matches) {
    if (m[2].trim()) count++;
  }
  return count;
}

interface NewspicResult {
  content: string;
  imageCount: number;
}

/**
 * HTML → 适合公众号 newspic 模式的内容：
 * - 块级元素（h1/h2/p/blockquote/li 等）转成段落，段落之间空行
 * - <img src> 转 ![alt](src) 单独成行（空 src 丢弃）
 * - 其他标签全部剥掉
 * - 文字部分按 maxChars 截断（图片标记不计入字符 cap）
 */
export function htmlToNewspicMarkdown(html: string, maxChars: number): NewspicResult {
  // 1. 把 <img> 替换为 IMG\d+ 占位 token，先记下其 markdown
  const images: string[] = [];
  const withTokens = html.replace(/<img\b([^>]*)>/gi, (_full, attrs: string) => {
    const srcMatch = attrs.match(/\bsrc\s*=\s*(['"])([^'"]*)\1/i);
    const altMatch = attrs.match(/\balt\s*=\s*(['"])([^'"]*)\1/i);
    const src = srcMatch?.[2]?.trim() ?? '';
    if (!src) return '';
    const alt = altMatch?.[2] ?? '';
    const idx = images.length;
    images.push(`![${alt}](${src})`);
    return `\nIMG${idx}\n`;
  });

  // 2. 块级标签转换为换行
  const BLOCK_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'blockquote', 'li', 'hr'];
  let blockBroken = withTokens;
  for (const tag of BLOCK_TAGS) {
    const closeRe = new RegExp(`</${tag}>`, 'gi');
    blockBroken = blockBroken.replace(closeRe, '\n\n');
  }
  blockBroken = blockBroken.replace(/<br\s*\/?>/gi, '\n');

  // 3. 剥光剩余标签 + 解码实体 + 收紧空白
  const cleaned = decodeEntities(stripTags(blockBroken))
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 4. 按 IMG\d+ 切段，文字部分按 maxChars 截断（占位不计）
  const parts = cleaned.split(/(IMG\d+)/);
  let textBudget = maxChars;
  const out: string[] = [];
  for (const part of parts) {
    if (/^IMG\d+$/.test(part)) {
      out.push(part);
      continue;
    }
    if (textBudget <= 0) continue;
    if (part.length <= textBudget) {
      out.push(part);
      textBudget -= part.length;
    } else {
      out.push(part.slice(0, textBudget));
      textBudget = 0;
    }
  }

  // 5. 占位 token 还原为 markdown 图片
  const finalText = out
    .join('')
    .replace(/IMG(\d+)/g, (_, n) => images[Number(n)] ?? '');

  return {
    content: finalText.replace(/\n{3,}/g, '\n\n').trim(),
    imageCount: images.length,
  };
}
