import { t9Reducer } from '../use-t9';

const initial = {
  text: '',
  pendingKey: null,
  pendingIndex: 0,
  mode: 'abc' as const,
};

test('multi-tap cycles letters on the same key and commits on another', () => {
  let state = t9Reducer(initial, { type: 'press', key: '7' });
  state = t9Reducer(state, { type: 'press', key: '7' });
  state = t9Reducer(state, { type: 'press', key: '7' });
  expect(state.text).toBe('r');
  state = t9Reducer(state, { type: 'press', key: '2' });
  expect(state.text).toBe('ra');
});

test('number mode types digits directly (PIN)', () => {
  let state = t9Reducer(
    { ...initial, mode: '123' },
    { type: 'press', key: '1' },
  );
  state = t9Reducer(state, { type: 'press', key: '2' });
  expect(state.text).toBe('12');
});
