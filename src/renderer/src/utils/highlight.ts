const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (c) => HTML_ESCAPE[c]);
}

/**
 * Returns HTML with JSON tokens wrapped in Tailwind-colored spans. Input is
 * HTML-escaped first, so the result is safe to inject via dangerouslySetInnerHTML.
 */
export function highlightJson(json: string): string {
  const escaped = escapeHtml(json);
  return escaped.replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"\s*:?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'text-amber-600 dark:text-amber-400'; // number
      if (match[0] === '"') {
        cls = /:\s*$/.test(match)
          ? 'text-sky-700 dark:text-sky-300' // object key
          : 'text-emerald-700 dark:text-emerald-400'; // string value
      } else if (match === 'true' || match === 'false') {
        cls = 'text-violet-600 dark:text-violet-400';
      } else if (match === 'null') {
        cls = 'text-rose-600 dark:text-rose-400';
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}
