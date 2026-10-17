import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';

import type { Components } from 'react-markdown';

// The Markdown sits under the page's h2 section headings, so its own headings start at h3.
const shifted: Components = { h1: 'h3', h2: 'h4', h3: 'h5', h4: 'h6', h5: 'h6' };

/**
 * Markdown from the plugin files, rendered without raw HTML. A relative link or image points at
 * the file on GitHub, next to the Markdown file it came from.
 */
export function Markdown({ text, base }: { text: string; base: string | null }) {
  return (
    <ReactMarkdown
      components={shifted}
      urlTransform={(url, key) => {
        const safe = defaultUrlTransform(url);
        if (!base || !safe || /^[a-z][a-z0-9+.-]*:/i.test(safe) || safe.startsWith('#') || safe.startsWith('/')) return safe;
        const clean = safe.replace(/^\.\//, '');
        return key === 'src' ? `${base.replace('/blob/', '/raw/')}/${clean}` : `${base}/${clean}`;
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
