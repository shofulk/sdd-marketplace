import type { ItemKind } from '../lib/catalog';

export function KindBadge({ kind }: { kind: ItemKind }) {
  return <span className={`kind k-${kind}`}>{kind}</span>;
}

export function KindDot({ kind }: { kind: ItemKind }) {
  return <span className={`dot d-${kind}`} aria-hidden="true" />;
}

export function Ver({ v, label, stable }: { v: string; label?: string; stable?: boolean }) {
  return <span className={`ver num${stable ? ' stable' : ''}`}>{label ? `${label} ${v}` : `v${v}`}</span>;
}
