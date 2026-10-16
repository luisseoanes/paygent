import { CircleAlert, CircleCheck, CircleX, Info, X } from 'lucide-react';
import * as React from 'react';

import { type Notification as NotificationType } from './notifications-store';

const AUTO_DISMISS_MS = 5000;

const icons = {
  info: <Info className="size-5 text-info" aria-hidden="true" />,
  success: <CircleCheck className="size-5 text-success" aria-hidden="true" />,
  warning: <CircleAlert className="size-5 text-warning" aria-hidden="true" />,
  error: <CircleX className="size-5 text-destructive" aria-hidden="true" />,
};

export type NotificationProps = {
  notification: NotificationType;
  onDismiss: (id: string) => void;
};

export const Notification = ({
  notification: { id, type, title, message },
  onDismiss,
}: NotificationProps) => {
  React.useEffect(() => {
    const timeout = setTimeout(() => onDismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [id, onDismiss]);

  return (
    <div
      role="alert"
      aria-label={title}
      className="pointer-events-auto w-full max-w-sm animate-in overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg fade-in-0 slide-in-from-top-2"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="shrink-0">{icons[type]}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          {message && (
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => onDismiss(id)}
        >
          <span className="sr-only">Close</span>
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
