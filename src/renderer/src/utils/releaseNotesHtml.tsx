/**
 * Renders release notes as the HTML they actually are. electron-updater's
 * `releaseNotes` (see main/autoUpdate.ts) comes from GitHub's own
 * markdown-to-HTML rendering of the release body (via the releases.atom
 * feed) — not markdown itself, so parsing it as markdown (this file's
 * previous approach) just showed the raw tags as literal text. Rendered via
 * dangerouslySetInnerHTML: the content originates from this project's own
 * CI-generated release body, not arbitrary user input, so this is trusted
 * content rather than an XSS surface.
 */
export function ReleaseNotesHtml({ html }: { html: string }) {
  return (
    <div
      className="space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300 [&_a]:text-brand-600 [&_a]:underline dark:[&_a]:text-brand-400 [&_h1]:mt-3 [&_h1]:text-xs [&_h1]:font-semibold [&_h1]:text-slate-700 first:[&_h1]:mt-0 dark:[&_h1]:text-slate-200 [&_h2]:mt-3 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:text-slate-700 first:[&_h2]:mt-0 dark:[&_h2]:text-slate-200 [&_h3]:mt-3 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-slate-700 first:[&_h3]:mt-0 dark:[&_h3]:text-slate-200 [&_p]:my-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
