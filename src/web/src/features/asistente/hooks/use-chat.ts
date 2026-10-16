import * as React from 'react';

import { puertoHttp } from '../api/puerto-http';
import { type MensajeChat, type PuertoChat } from '../types';

// Estado del chat: envía por el puerto, muestra "pensando" hasta el primer
// trozo y revela la respuesta letra a letra aunque llegue en bloques.

export type EstadoChat = 'libre' | 'pensando' | 'escribiendo';

const nuevoId = () => Math.random().toString(36).slice(2, 10);

// Letras por cuadro: si se acumula texto pendiente, acelera para no quedarse atrás.
const letrasPorCuadro = (pendientes: number) =>
  Math.max(1, Math.ceil(pendientes / 40));

export const useChat = ({
  puerto = puertoHttp,
  contexto,
}: { puerto?: PuertoChat; contexto?: Record<string, string> } = {}) => {
  const [mensajes, setMensajes] = React.useState<MensajeChat[]>([]);
  const [estado, setEstado] = React.useState<EstadoChat>('libre');
  const abortRef = React.useRef<AbortController | null>(null);
  const pendienteRef = React.useRef('');
  const terminoRef = React.useRef(false);
  const frameRef = React.useRef<number | null>(null);
  const idRef = React.useRef<string | null>(null);

  const actualizar = React.useCallback(
    (id: string, cambio: (m: MensajeChat) => MensajeChat) =>
      setMensajes((ms) => ms.map((m) => (m.id === id ? cambio(m) : m))),
    [],
  );

  const detenerAnimacion = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };

  // Bucle de tecleo: saca letras de lo pendiente y las pinta.
  const teclear = React.useCallback(() => {
    const id = idRef.current;
    if (!id) return;
    const pendiente = pendienteRef.current;
    if (pendiente.length > 0) {
      const n = letrasPorCuadro(pendiente.length);
      pendienteRef.current = pendiente.slice(n);
      actualizar(id, (m) => ({ ...m, texto: m.texto + pendiente.slice(0, n) }));
    } else if (terminoRef.current) {
      actualizar(id, (m) => ({ ...m, estado: 'listo' }));
      setEstado('libre');
      idRef.current = null;
      frameRef.current = null;
      return;
    }
    frameRef.current = requestAnimationFrame(teclear);
  }, [actualizar]);

  const pedir = React.useCallback(
    async (historial: MensajeChat[]) => {
      const id = nuevoId();
      const controlador = new AbortController();
      abortRef.current = controlador;
      idRef.current = id;
      pendienteRef.current = '';
      terminoRef.current = false;
      setEstado('pensando');
      setMensajes([
        ...historial,
        {
          id,
          rol: 'asistente',
          texto: '',
          estado: 'escribiendo',
          creado: Date.now(),
        },
      ]);

      try {
        await puerto.enviar(
          {
            mensajes: historial
              .filter((m) => m.estado !== 'error')
              .map(({ rol, texto }) => ({ rol, texto })),
            contexto,
          },
          {
            signal: controlador.signal,
            onTrozo: (trozo) => {
              pendienteRef.current += trozo;
              if (frameRef.current === null) {
                setEstado('escribiendo');
                frameRef.current = requestAnimationFrame(teclear);
              }
            },
          },
        );
        terminoRef.current = true;
        if (frameRef.current === null)
          frameRef.current = requestAnimationFrame(teclear);
      } catch (e) {
        if (controlador.signal.aborted) return;
        detenerAnimacion();
        idRef.current = null;
        actualizar(id, (m) => ({
          ...m,
          estado: 'error',
          texto:
            m.texto || (e instanceof Error ? e.message : 'No pude responder.'),
        }));
        setEstado('libre');
      }
    },
    [puerto, contexto, teclear, actualizar],
  );

  const enviar = React.useCallback(
    (texto: string) => {
      const limpio = texto.trim();
      if (!limpio || estado !== 'libre') return;
      void pedir([
        ...mensajes,
        {
          id: nuevoId(),
          rol: 'usuario',
          texto: limpio,
          estado: 'listo',
          creado: Date.now(),
        },
      ]);
    },
    [estado, mensajes, pedir],
  );

  // Detener: corta la petición y deja lo que ya se escribió.
  const detener = React.useCallback(() => {
    abortRef.current?.abort();
    detenerAnimacion();
    const id = idRef.current;
    if (id) {
      const resto = pendienteRef.current;
      setMensajes((ms) =>
        ms.flatMap((m) =>
          m.id !== id
            ? [m]
            : m.texto + resto
              ? [{ ...m, texto: m.texto + resto, estado: 'listo' as const }]
              : [],
        ),
      );
    }
    pendienteRef.current = '';
    idRef.current = null;
    setEstado('libre');
  }, []);

  // Reintentar: vuelve a pedir la respuesta del último mensaje fallido.
  const reintentar = React.useCallback(() => {
    const sinError = mensajes.filter((m) => m.estado !== 'error');
    if (sinError.at(-1)?.rol === 'usuario') void pedir(sinError);
  }, [mensajes, pedir]);

  const reiniciar = React.useCallback(() => {
    detener();
    setMensajes([]);
  }, [detener]);

  React.useEffect(
    () => () => {
      abortRef.current?.abort();
      detenerAnimacion();
    },
    [],
  );

  return { mensajes, estado, enviar, detener, reintentar, reiniciar };
};
