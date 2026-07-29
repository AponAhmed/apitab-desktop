import type { ReactNode } from 'react';

/**
 * Deliberately tiny, dependency-free renderer for the specific markdown
 * shape release notes actually take (see build.yml's changelog generation
 * and GitHub's own release-notes format): `## ` headings, `- `/`* ` bullet
 * lists, `**bold**`, `[text](url)` links, and bare URLs. No general markdown
 * support (tables, code blocks, nested lists) — not needed for this content,
 * and every output element is real JSX (never raw HTML), so there's no XSS
 * surface to worry about even though this text ultimately comes from GitHub.
 */

const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(\*\*)((?:(?!\*\*).)+)\3|(https?:\/\/\S+)/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(LINK_PATTERN)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(text.slice(last, idx));
    if (m[1] && m[2]) {
      nodes.push(
        <a key={key++} href={m[2]} target="_blank" rel="noreferrer" className="text-brand-600 underline dark:text-brand-400">
          {m[1]}
        </a>,
      );
    } else if (m[4]) {
      nodes.push(<strong key={key++}>{m[4]}</strong>);
    } else if (m[5]) {
      nodes.push(
        <a key={key++} href={m[5]} target="_blank" rel="noreferrer" className="text-brand-600 underline dark:text-brand-400">
          {m[5]}
        </a>,
      );
    }
    last = idx + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MiniMarkdown({ text }: { text: string }): ReactNode {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let blockKey = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={blockKey++} className="list-disc space-y-0.5 pl-4">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (heading) {
      flushList();
      blocks.push(
        <h4 key={blockKey++} className="mt-2 text-xs font-semibold text-slate-700 first:mt-0 dark:text-slate-200">
          {renderInline(heading[2])}
        </h4>,
      );
    } else if (bullet) {
      listItems.push(bullet[1]);
    } else {
      flushList();
      blocks.push(
        <p key={blockKey++} className="text-slate-600 dark:text-slate-300">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushList();

  return <div className="space-y-1.5 text-xs leading-relaxed">{blocks}</div>;
}
