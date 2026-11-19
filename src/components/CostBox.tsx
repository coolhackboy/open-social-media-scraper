import clsx from 'clsx';
import { Coins } from 'lucide-react';
import type { ReactNode } from 'react';
import { fmtCredits, fmtUSD, type Estimate } from '../lib/cost';

export function CostBox({ est, label = 'Estimated cost', note, className, compact }: { est: Estimate | null; label?: string; note?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={clsx('rounded-lg border border-line bg-surface-2/70', compact ? 'px-3 py-2' : 'px-3 py-2.5', className)}>
      <div className="flex items-center gap-2">
        <Coins className="size-4 shrink-0 text-accent" />
        <span className="text-[12.5px] text-fg-muted">{label}</span>
        <span className="ml-auto text-right">
          {est ? (
            <>
              <span className="tabular text-[14px] font-semibold">{fmtCredits(est.credits)} credits</span>
              <span className="tabular ml-1.5 text-[12.5px] text-fg-muted">≈ {fmtUSD(est.usd)}</span>
            </>
          ) : (
            <span className="text-[12.5px] text-fg-subtle">unknown</span>
          )}
        </span>
      </div>
      {!compact && est && (
        <p className="mt-1 font-mono text-[11px] text-fg-subtle">
          {est.basis}
          {est.assumed ? ' (catalog default)' : ''}
        </p>
      )}
      {note && <div className="mt-1 text-[11.5px] leading-snug text-fg-subtle">{note}</div>}
    </div>
  );
}
