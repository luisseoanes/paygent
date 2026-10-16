// Contrato del chat con el asistente. El backend solo tiene que cumplir el
// puerto `PuertoChat`; la UI no sabe si detrás hay HTTP, SSE o un mock.

export type RolMensaje = 'usuario' | 'asistente';

export type MensajeChat = {
  id: string;
  rol: RolMensaje;
  texto: string;
  // 'escribiendo': el texto aún va llegando; 'error': falló la respuesta
  estado: 'listo' | 'escribiendo' | 'error';
  creado: number;
};

// Lo que viaja al backend: solo rol y texto, sin estado de la UI.
export type MensajeContrato = { rol: RolMensaje; texto: string };

export type PeticionChat = {
  mensajes: MensajeContrato[];
  // Quién habla (p. ej. el id del mandato de María) para que el agente tenga contexto
  contexto?: Record<string, string>;
};

export type OpcionesEnvio = {
  signal: AbortSignal;
  // Se llama con cada trozo de texto que llega (streaming)
  onTrozo: (trozo: string) => void;
};

export type PuertoChat = {
  enviar: (peticion: PeticionChat, opciones: OpcionesEnvio) => Promise<void>;
};
