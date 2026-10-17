import { issueToken } from '../src/auth/session.ts'

/** Cabecera de sesión de una cuenta (lo que manda la web tras el login). */
export const asUser = (userId: string) => ({ authorization: `Bearer ${issueToken(userId)}` })
/** El servicio de agentes actuando como `agentId`. */
export const asAgent = (agentId = 'asistente') => ({ 'x-api-key': 'dev-agents-key', 'x-agent-id': agentId })
