import { act, renderHook } from '@testing-library/react';

import { useDisclosure } from '../use-disclosure';

test('should open, close and toggle the state', () => {
  const { result } = renderHook(() => useDisclosure());

  expect(result.current.isOpen).toBe(false);

  act(() => result.current.open());
  expect(result.current.isOpen).toBe(true);

  act(() => result.current.close());
  expect(result.current.isOpen).toBe(false);

  act(() => result.current.toggle());
  expect(result.current.isOpen).toBe(true);
});
