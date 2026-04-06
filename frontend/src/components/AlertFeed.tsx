/**
 * AlertFeed — displays a list of severity-tagged alerts.
 * Renders "No active alerts" when the alerts array is empty.
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  message: string;
}

// ─── Severity config ──────────────────────────────────────────────────────────

const severityConfig: Record<
  AlertSeverity,
  { label: string; badgeClass: string; dotClass: string }
> = {
  info: {
    label: 'Info',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
    dotClass: 'bg-blue-500',
  },
  warning: {
    label: 'Warning',
    badgeClass: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400',
    dotClass: 'bg-yellow-500',
  },
  critical: {
    label: 'Critical',
    badgeClass: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
    dotClass: 'bg-red-500',
  },
};

// ─── AlertFeed ────────────────────────────────────────────────────────────────

interface AlertFeedProps {
  alerts: Alert[];
}

export function AlertFeed({ alerts }: AlertFeedProps) {
  return (
    <div className="px-4 py-3 border-t">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Alerts
      </p>

      {alerts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active alerts</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((alert) => {
            const config = severityConfig[alert.severity];
            return (
              <li key={alert.id} className="flex items-start gap-2">
                <span
                  className={cn(
                    'mt-1.5 size-1.5 rounded-full shrink-0',
                    config.dotClass
                  )}
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <Badge
                    variant="outline"
                    className={cn('w-fit text-[10px] h-4', config.badgeClass)}
                  >
                    {config.label}
                  </Badge>
                  <p className="text-xs text-foreground leading-snug">{alert.message}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
