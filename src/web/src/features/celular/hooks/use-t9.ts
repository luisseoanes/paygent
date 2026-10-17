// T9 multi-tap como en un Nokia: pulsar la misma tecla rápido recorre sus
// letras; otra tecla (o 900ms de pausa) confirma. # alterna abc / 123.

export const T9_KEYS: Record<string, string> = {
  '1': '.,?!1',
  '2': 'abc2',
  '3': 'def3',
  '4': 'ghi4',
  '5': 'jkl5',
  '6': 'mno6',
  '7': 'pqrs7',
  '8': 'tuv8',
  '9': 'wxyz9',
  '0': ' 0',
};

export type T9Mode = 'abc' | '123';

type State = {
  text: string;
  pendingKey: string | null;
  pendingIndex: number;
  mode: T9Mode;
};

type Action =
  | { type: 'press'; key: string }
  | { type: 'commit' }
  | { type: 'type'; char: string }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'mode'; mode?: T9Mode };

export const t9Reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'press': {
      const letters = T9_KEYS[action.key];
      if (!letters) return state;
      if (state.mode === '123') {
        return { ...state, text: state.text + action.key, pendingKey: null };
      }
      if (state.pendingKey === action.key) {
        const nextIndex = (state.pendingIndex + 1) % letters.length;
        return {
          ...state,
          text: state.text.slice(0, -1) + letters[nextIndex],
          pendingIndex: nextIndex,
        };
      }
      return {
        ...state,
        text: state.text + letters[0],
        pendingKey: action.key,
        pendingIndex: 0,
      };
    }
    case 'commit':
      return { ...state, pendingKey: null, pendingIndex: 0 };
    case 'type':
      return { ...state, text: state.text + action.char, pendingKey: null };
    case 'backspace':
      return { ...state, text: state.text.slice(0, -1), pendingKey: null };
    case 'clear':
      return { ...state, text: '', pendingKey: null };
    case 'mode': {
      const mode = action.mode ?? (state.mode === 'abc' ? '123' : 'abc');
      if (mode === state.mode && state.pendingKey === null) return state;
      return { ...state, pendingKey: null, mode };
    }
    default:
      return state;
  }
};
