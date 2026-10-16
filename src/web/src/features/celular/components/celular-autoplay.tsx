import * as React from 'react';

import { cn } from '@/utils/cn';

import { T9_KEYS } from '../hooks/use-t9';

// Celular de tapa (abierto, en 3D) en modo demostración: reproduce una conversación con el
// agente según el paso que le indiquen (lo controla el hero de la portada).
// Es solo visual; no toca el gateway.

const PEDIDO = 'necesito la pastilla de la presion';
const OFERTA =
  'Farmacia San Jose tiene losartan a $12.000, a 3 cuadras. Responde tu PIN para pagar.';
const PAGADO = 'Pagado. Codigo de retiro 4821.';
const PIN = '1234';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const teclaDe = (char: string) => {
  if (char === ' ') return '0';
  return Object.keys(T9_KEYS).find((k) => T9_KEYS[k]?.includes(char)) ?? null;
};

// Revela un texto letra a letra mientras el paso está activo.
const useTecleo = (texto: string, activo: boolean, duracion: number) => {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!activo) {
      setN(0);
      return;
    }
    const paso = duracion / texto.length;
    const id = setInterval(
      () => setN((v) => (v >= texto.length ? v : v + 1)),
      paso,
    );
    return () => clearInterval(id);
  }, [activo, texto, duracion]);
  return texto.slice(0, n);
};

// Esquinas escalonadas (dos peldaños de `p` px) para el look pixel art.
const ESQUINAS = (p: number) => {
  const a = `${p}px`;
  const b = `${p * 2}px`;
  return `polygon(0 ${b}, ${a} ${b}, ${a} ${a}, ${b} ${a}, ${b} 0, calc(100% - ${b}) 0, calc(100% - ${b}) ${a}, calc(100% - ${a}) ${a}, calc(100% - ${a}) ${b}, 100% ${b}, 100% calc(100% - ${b}), calc(100% - ${a}) calc(100% - ${b}), calc(100% - ${a}) calc(100% - ${a}), calc(100% - ${b}) calc(100% - ${a}), calc(100% - ${b}) 100%, ${b} 100%, ${b} calc(100% - ${a}), ${a} calc(100% - ${a}), ${a} calc(100% - ${b}), 0 calc(100% - ${b}))`;
};

// Brillo arriba y sombra abajo con bordes duros, sin desenfoque.
const BRILLO =
  'inset 0 2px 0 rgb(255 255 255 / 0.12), inset 0 -3px 0 rgb(0 0 0 / 0.35)';

const TECLA_SUAVE = 'h-3 bg-carcasa-2 shadow-[inset_0_-2px_0_rgb(0_0_0/0.35)]';

// Capas apiladas hacia atrás: le dan grosor a cada mitad del celular.
const CAPAS = 7;

const Carcasa = ({ children }: { children: React.ReactNode }) => (
  <>
    {Array.from({ length: CAPAS }, (_, i) => (
      <span
        key={i}
        aria-hidden="true"
        className="absolute inset-0 bg-grafito"
        style={{
          clipPath: ESQUINAS(8),
          transform: `translateZ(${-(i + 1) * 2}px)`,
          filter: `brightness(${1 - i * 0.06})`,
        }}
      />
    ))}
    <div
      className="absolute inset-0 bg-carcasa"
      style={{
        clipPath: ESQUINAS(8),
        boxShadow:
          'inset 0 3px 0 rgb(255 255 255 / 0.1), inset 0 -4px 0 rgb(0 0 0 / 0.3)',
      }}
    >
      {children}
    </div>
  </>
);

type Mensaje = { de: 'rosa' | 'agente'; texto: string };

export type CelularAutoplayProps = {
  // 0 espera · 1 escribiendo · 2 consultando · 3 oferta · 4 PIN · 5 pagado
  paso: number;
  className?: string;
};

export const CelularAutoplay = ({ paso, className }: CelularAutoplayProps) => {
  const pedido = useTecleo(PEDIDO, paso === 1, 1700);
  const pin = useTecleo(PIN, paso === 4, 1000);

  const mensajes: Mensaje[] = [];
  if (paso >= 2) mensajes.push({ de: 'rosa', texto: PEDIDO });
  if (paso >= 3) mensajes.push({ de: 'agente', texto: OFERTA });
  if (paso >= 5) {
    mensajes.push({ de: 'rosa', texto: '••••' });
    mensajes.push({ de: 'agente', texto: PAGADO });
  }

  const redaccion =
    paso === 1 ? pedido : paso === 4 ? '•'.repeat(pin.length) : '';
  const ultimaLetra =
    paso === 1 ? pedido.slice(-1) : paso === 4 ? pin.slice(-1) : '';
  const teclaActiva = ultimaLetra ? teclaDe(ultimaLetra) : null;
  const vibra = paso === 3 || paso === 5;
  return (
    <div
      role="img"
      aria-label="Demostración: un celular de tapa pide por SMS la pastilla de la presión, el agente encuentra la farmacia, se confirma con PIN y el pago queda hecho."
      className={cn('w-full max-w-[300px]', className)}
    >
      {/* Escena 3D: la tapa con la pantalla queda de pie y el teclado se
          abre hacia quien mira, girado a la izquierda. */}
      <div className="relative h-[420px] [perspective-origin:60%_30%] [perspective:1100px] sm:h-[500px]">
        <div
          key={vibra ? `vibra-${paso}` : 'quieto'}
          className={cn(
            'absolute inset-0 [transform-style:preserve-3d]',
            vibra && 'vibrar',
          )}
        >
          <div
            className="absolute top-2 right-0 h-[300px] w-[232px] origin-top-right scale-[0.8] [transform-style:preserve-3d] sm:right-2 sm:scale-100"
            style={{ transform: 'rotateY(-24deg) rotateX(6deg)' }}
          >
            {/* Tapa superior: pantalla */}
            <span
              aria-hidden="true"
              className="absolute -top-4 right-5 h-6 w-3 [transform:translateZ(-6px)] bg-carcasa-2"
              style={{ clipPath: ESQUINAS(3), boxShadow: BRILLO }}
            />
            <Carcasa>
              <div className="absolute inset-0 flex flex-col p-3.5 pb-4">
                <div
                  className="mb-2.5 flex items-center justify-center gap-3"
                  aria-hidden="true"
                >
                  <span
                    className={cn(
                      'size-2',
                      vibra ? 'pulso bg-led' : 'bg-carcasa-2',
                    )}
                  />
                  <span className="h-1.5 w-14 bg-carcasa-2" />
                </div>

                <div
                  className="min-h-0 flex-1 bg-carcasa-2 p-1.5"
                  style={{ clipPath: ESQUINAS(4) }}
                >
                  <div className="flex h-full flex-col overflow-hidden bg-lcd font-lcd text-lcd-ink shadow-[inset_0_3px_0_rgb(0_0_0/0.25)]">
                    <div className="flex items-center justify-between border-b border-lcd-ink/30 px-2 text-[0.9rem] leading-snug">
                      <span>▂▄▆</span>
                      <span>SMS · {paso === 4 ? '123' : 'abc'}</span>
                      <span>▮▮▮▯</span>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5 overflow-hidden px-2 py-1.5 text-[1.05rem] leading-[1.05]">
                      {mensajes.length === 0 && paso < 2 && (
                        <p className="my-auto text-center opacity-60">
                          Escribe lo que necesitas.
                        </p>
                      )}
                      {mensajes.map((m, i) => (
                        <p
                          key={i}
                          className={cn(
                            'max-w-[92%] shrink-0',
                            m.de === 'rosa' ? 'ml-auto text-right' : 'mr-auto',
                          )}
                        >
                          <span className="block text-[0.8rem] opacity-70">
                            {m.de === 'rosa' ? 'Tu' : 'Asistente'}
                          </span>
                          <span
                            className={cn(
                              'inline-block px-1',
                              m.de === 'agente' && 'bg-lcd-ink text-lcd',
                            )}
                          >
                            {m.texto}
                          </span>
                        </p>
                      ))}
                      {paso === 2 && (
                        <p className="opacity-70">Asistente escribiendo…</p>
                      )}
                    </div>
                    <div className="border-t border-lcd-ink/30 px-2 py-0.5 text-[1.05rem] leading-tight">
                      {redaccion}
                      <span
                        aria-hidden="true"
                        className="ml-px inline-block h-[0.9rem] w-1.5 translate-y-0.5 animate-pulse bg-lcd-ink"
                      />
                    </div>
                    <div className="flex justify-between px-2 pb-0.5 text-[0.9rem] leading-none">
                      <span>{paso === 4 ? 'PIN' : 'Enviar'}</span>
                      <span>Borrar</span>
                    </div>
                  </div>
                </div>
              </div>
            </Carcasa>

            {/* Bisagra */}
            <span
              aria-hidden="true"
              className="absolute -bottom-2 left-1/2 h-4 w-[70%] -translate-x-1/2 bg-[linear-gradient(to_bottom,var(--carcasa-2)_0_25%,var(--carcasa)_25%_75%,var(--grafito)_75%)]"
              style={{ clipPath: ESQUINAS(3) }}
            />

            {/* Mitad inferior: teclado abierto hacia quien mira */}
            <div
              aria-hidden="true"
              className="absolute top-full left-0 h-[272px] w-full origin-top [transform-style:preserve-3d]"
              style={{ transform: 'rotateX(58deg)' }}
            >
              <Carcasa>
                <div className="absolute inset-0 flex flex-col gap-2.5 p-3.5">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="grid gap-1.5">
                      <span className={TECLA_SUAVE} />
                      <span className={cn(TECLA_SUAVE, 'bg-led/70')} />
                    </div>
                    <span
                      className="grid size-14 place-items-center bg-carcasa-2"
                      style={{ clipPath: ESQUINAS(6), boxShadow: BRILLO }}
                    >
                      <span
                        className="size-6 bg-carcasa"
                        style={{ clipPath: ESQUINAS(3) }}
                      />
                    </span>
                    <div className="grid gap-1.5">
                      <span className={TECLA_SUAVE} />
                      <span className={cn(TECLA_SUAVE, 'bg-destructive/80')} />
                    </div>
                  </div>

                  <div className="grid flex-1 grid-cols-3 gap-1.5">
                    {KEYS.map((k) => (
                      <span
                        key={k}
                        className={cn(
                          'flex flex-col items-center justify-center bg-carcasa-2 text-paper-raised transition-colors duration-100',
                          teclaActiva === k && 'bg-firma',
                        )}
                        style={{ clipPath: ESQUINAS(4), boxShadow: BRILLO }}
                      >
                        <span className="font-mono text-sm leading-none font-semibold">
                          {k}
                        </span>
                        <span className="font-mono text-[0.5rem] tracking-wider text-ink-3 uppercase">
                          {T9_KEYS[k]?.slice(0, -1) ?? ''}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </Carcasa>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
