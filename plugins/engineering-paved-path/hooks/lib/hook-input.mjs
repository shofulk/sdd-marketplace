// Reads a Claude Code hook payload from stdin.
// Canonical copy: tools/hooklib/ in the sdd-marketplace repository; plugins carry synced copies
// in hooks/lib/ (npm run sync-hooklib). Edit the canonical copy only.

/** Parses stdin as JSON. Resolves to the object, or null when stdin is empty or not a JSON object. */
export function readHookInput(stream = process.stdin) {
  return new Promise((resolve) => {
    let raw = '';
    if (stream.isTTY) return resolve(null);
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => (raw += chunk));
    stream.on('error', () => resolve(null));
    stream.on('end', () => {
      if (!raw.trim()) return resolve(null);
      try {
        const value = JSON.parse(raw);
        resolve(value && typeof value === 'object' && !Array.isArray(value) ? value : null);
      } catch {
        resolve(null);
      }
    });
  });
}

/** One stderr line prefixed with the hook's name; hooks never print to stdout unless they mean it. */
export function note(hook, message) {
  process.stderr.write(`${hook}: ${message}\n`);
}
