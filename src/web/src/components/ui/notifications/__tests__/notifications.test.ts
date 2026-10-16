import { act, renderHook } from '@testing-library/react';

import { type Notification, useNotifications } from '../notifications-store';

test('should add and dismiss notifications', () => {
  const { result } = renderHook(() => useNotifications());

  expect(result.current.notifications).toHaveLength(0);

  const notification: Omit<Notification, 'id'> = {
    title: 'Hello World',
    type: 'info',
    message: 'This is a notification',
  };

  act(() => result.current.addNotification(notification));

  expect(result.current.notifications).toContainEqual(
    expect.objectContaining(notification),
  );

  const id = result.current.notifications[0]!.id;
  act(() => result.current.dismissNotification(id));

  expect(result.current.notifications).toHaveLength(0);
});
