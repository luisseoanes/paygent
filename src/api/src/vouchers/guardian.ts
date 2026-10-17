import { amount as A, type Amount, type Mandate } from '@openroute/shared'
import { vouchersOfMandate } from '../store/offline.ts'
import { emit } from '../feed/bus.ts'
import { offlineDevices, restrict } from '../gateway/mandates.ts'
import { callAgents } from '../lib/agents.ts'

export type CapChange = { mandateId: string; from?: Amount; to?: Amount; error?: string }

/**
 * GRD-02: el Guardián recalcula el tope sin señal de cada celular según su historial.
 * Siempre acotado por el techo del titular (offlineCapCeiling) vía restrict(). Si el Guardián no responde, no cambia nada.
 */
export const reviewOfflineCaps = async (onlyMandateIds?: string[]): Promise<CapChange[]> => {
  const devices = (await offlineDevices()).filter((m: Mandate) => !onlyMandateIds || onlyMandateIds.includes(m.id))
  const changes: CapChange[] = []
  for (const m of devices) {
    const history = (await vouchersOfMandate(m.id)).map((s) => ({ ...s.voucher, status: s.status }))
    const res = await callAgents<{ newCap: Amount; explanation: string }>('/guardian/score', {
      mandateId: m.id,
      holderName: m.holderName,
      offlineCap: m.offlineCap,
      ceiling: m.offlineCapCeiling ?? m.offlineCap,
      frozen: m.frozen,
      history,
    })
    if (!res || A.cmp(res.newCap, m.offlineCap!) === 0) continue
    try {
      const updated = await restrict(m.id, { offlineCap: res.newCap })
      await emit({ mandateId: m.id, actor: { type: 'agent', name: 'Guardián' }, kind: 'guardian', amount: res.newCap, reason: res.explanation })
      changes.push({ mandateId: m.id, from: m.offlineCap, to: updated.offlineCap })
    } catch (err) {
      changes.push({ mandateId: m.id, error: (err as Error).message })
    }
  }
  return changes
}
