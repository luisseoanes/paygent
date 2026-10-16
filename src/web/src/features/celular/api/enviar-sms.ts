import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { type MutationConfig } from '@/lib/react-query';

// SMS-02: el celular simulado usa el mismo endpoint al que llegaría el SMS real
// (POST /sms/inbound). La api se lo pasa al Agente Asistente y devuelve su respuesta.
export const enviarSms = ({
  from,
  body,
}: {
  from: string;
  body: string;
}): Promise<{ reply: string }> =>
  api.post('/sms/inbound', { From: from, Body: body });

type UseEnviarSmsOptions = {
  mutationConfig?: MutationConfig<typeof enviarSms>;
};

export const useEnviarSms = ({ mutationConfig }: UseEnviarSmsOptions = {}) =>
  useMutation({ ...mutationConfig, mutationFn: enviarSms });
