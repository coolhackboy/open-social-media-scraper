import clsx from 'clsx';
import { useToasts } from '../lib/store';

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-3 bottom-10 z-50 flex flex-col items-end gap-2 sm:right-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={clsx(
            'animate-in pointer-events-auto max-w-[min(360px,calc(100vw-24px))] rounded-lg border px-3 py-2 text-left text-[12.5px] shadow-pop',
            t.tone === 'bad' ? 'border-bad/30 bg-surface text-bad' : t.tone === 'ok' ? 'border-ok/30 bg-surface text-fg' : 'border-line bg-surface text-fg',
          )}
        >
          {t.tone === 'ok' && <span className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-ok" />}
          {t.text}
        </button>
      ))}
    </div>
  );
}
