import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type PuertoChat } from '@/features/asistente/types';

import { useChat } from '../use-chat';

const puertoQueResponde = (trozos: string[]): PuertoChat => ({
  enviar: async (_peticion, { onTrozo }) => {
    for (const t of trozos) onTrozo(t);
  },
});

describe('useChat', () => {
  it('envía el mensaje y arma la respuesta completa a partir de los trozos', async () => {
    const { result } = renderHook(() =>
      useChat({ puerto: puertoQueResponde(['Hola, ', 'María.']) }),
    );

    act(() => result.current.enviar('  hola  '));

    expect(result.current.mensajes[0]).toMatchObject({
      rol: 'usuario',
      texto: 'hola',
    });
    await waitFor(() => expect(result.current.estado).toBe('libre'));
    expect(result.current.mensajes[1]).toMatchObject({
      rol: 'asistente',
      texto: 'Hola, María.',
      estado: 'listo',
    });
  });

  it('marca el error y permite reintentar', async () => {
    let falla = true;
    const puerto: PuertoChat = {
      enviar: async (_p, { onTrozo }) => {
        if (falla) throw new Error('sin conexión');
        onTrozo('Listo');
      },
    };
    const { result } = renderHook(() => useChat({ puerto }));

    act(() => result.current.enviar('hola'));
    await waitFor(() =>
      expect(result.current.mensajes[1]?.estado).toBe('error'),
    );

    falla = false;
    act(() => result.current.reintentar());
    await waitFor(() =>
      expect(result.current.mensajes[1]?.texto).toBe('Listo'),
    );
    expect(result.current.mensajes).toHaveLength(2);
  });

  it('ignora mensajes vacíos', () => {
    const { result } = renderHook(() =>
      useChat({ puerto: puertoQueResponde([]) }),
    );
    act(() => result.current.enviar('   '));
    expect(result.current.mensajes).toHaveLength(0);
  });
});
