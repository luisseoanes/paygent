import { Notification } from './notification';
import { useNotifications } from './notifications-store';

export const Notifications = () => {
  const notifications = useNotifications((state) => state.notifications);
  const dismissNotification = useNotifications(
    (state) => state.dismissNotification,
  );

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-3 p-4 sm:items-end sm:p-6"
    >
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          notification={notification}
          onDismiss={dismissNotification}
        />
      ))}
    </div>
  );
};
