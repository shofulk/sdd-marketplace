import { useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/copy';

interface Props {
  text: string;
  className?: string;
  label?: string;
}

const COPIED_MS = 1600;
const TOAST_MS = 2600;

/** A copy button with its own status toast; when copying is blocked it says to select the text by hand. */
export function CopyButton({ text, className = 'btn', label = 'Copy' }: Props) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  const firstLine = text.split('\n')[0];

  async function onClick() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const ok = await copyText(text);
    setCopied(ok);
    setToast(ok ? `Copied: ${firstLine}` : `The browser blocked copying. Select the text by hand: ${firstLine}`);
    if (ok) later(() => setCopied(false), COPIED_MS);
    later(() => setToast(null), TOAST_MS);
  }

  return (
    <>
      <button type="button" className={`${className}${copied ? ' ok' : ''}`} onClick={onClick}>
        {copied ? '✓ Copied' : label}
      </button>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>
  );
}
