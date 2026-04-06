/**
 * AlertFeed — displays a list of severity-tagged alerts.
 * Renders "No active alerts" when the alerts array is empty.
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, AlertOctagon, Bell } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  message: string;
  timestamp?: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAlertTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ─── Severity config ──────────────────────────────────────────────────────────

const severityConfig: Record<
  AlertSeverity,
  {
    label: string;
    badgeClass: string;
    iconClass: string;
    Icon: typeof Info;
    pulse: boolean;
  }
> = {
  info: {
    label: 'Info',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
    iconClass: 'text-blue-500',
    Icon: Info,
    pulse: false,
  },
  warning: {
    label: 'Warning',
    badgeClass: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400',
    iconClass: 'text-yellow-500',
    Icon: AlertTriangle,
    pulse: false,
  },
  critical: {
    label: 'Critical',
    badgeClass: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
    iconClass: 'text-red-500',
    Icon: AlertOctagon,
    pulse: true,
  },
};

// ─── AlertFeed ────────────────────────────────────────────────────────────────

interface AlertFeedProps {
  alerts: Alert[];
}

export function AlertFeed({ alerts }: AlertFeedProps) {
  return (
    <div className="px-4 py-3 border-t">
      <div className="flex items-center gap-1.5 mb-2">
        <Bell className="size-3 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Alerts
        </p>
        {alerts.filter((a) => a.severity === 'critical').length > 0 && (
          <span className="ml-auto flex items-center justify-center size-4 rounded-full bg-red-500 text-[9px] font-bold text-white">
            {alerts.filter((a) => a.severity === 'critical').length}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active alerts</p>
      ) : (
        <ul className="space-y-2 max-h-36 overflow-y-auto pr-1">
          {alerts.map((alert) => {
            const config = severityConfig[alert.severity];
            const IconEl = config.Icon;
            return (
              <li
                key={alert.id}
                className={cn(
                  'flex items-start gap-2 rounded-md px-2 py-1.5',
                  alert.severity === 'critical' && 'bg-red-500/5'
                )}
              >
                {/* Icon — pulsing wrapper on critical */}
                <span
                  className={cn(
                    'mt-0.5 shrink-0',
                    config.pulse && 'animate-pulse'
                  )}
                  aria-hidden="true"
                >
                  <IconEl className={cn('size-3.5', config.iconClass)} />
                </span>

                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <Badge
                      variant="outline"
                      className={cn('w-fit text-[10px] h-4 shrink-0', config.badgeClass)}
                    >
                      {config.label}
                    </Badge>
                    {alert.timestamp && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatAlertTime(alert.timestamp)}
                      </span>
                    )}
                  </div>
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
