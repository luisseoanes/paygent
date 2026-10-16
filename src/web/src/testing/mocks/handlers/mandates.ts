import { HttpResponse, http, sse } from 'msw';

import { paths } from '@/config/paths';
import {
  type Amount,
  type Category,
  type FeedEvent,
  type HolderType,
  type MandateTree,
  type ModeView,
} from '@/types/api';

import { db, findInTree, usdAmount } from '../db';
import { apiUrl, networkDelay } from '../utils';

// Contratos de backlog.md §2.2 con las mismas reglas que apps/api: restrict
// solo restringe (descongelar va por /unfreeze), revoke va en cascada y
// delegate cumple los invariantes de GW-03. Los errores llegan como { error }.

const toNumber = (a: Amount) => Number(a.value) / 10 ** a.assetScale;

const cascade = (node: MandateTree, fn: (n: MandateTree) => void) => {
  fn(node);
  node.children.forEach((child) => cascade(child, fn));
};

const pathTo = (id: string): MandateTree[] => {
  const walk = (
    node: MandateTree,
    acc: MandateTree[],
  ): MandateTree[] | null => {
    const next = [...acc, node];
    if (node.id === id) return next;
    for (const child of node.children) {
      const found = walk(child, next);
      if (found) return found;
    }
    return null;
  };
  return walk(db.tree, []) ?? [];
};

const fail = (error: string, status: number) =>
  HttpResponse.json({ error }, { status });

const notFound = () => fail('Ese mandato no existe.', 404);

const normalizarCelular = (raw: string) => {
  const d = raw.replace(/[\s\-().]/g, '');
  if (/^3\d{9}$/.test(d)) return `+57${d}`;
  if (/^573\d{9}$/.test(d)) return `+${d}`;
  if (/^\+[1-9]\d{7,14}$/.test(d)) return d;
  return null;
};

// Todos iguales o en escalera (0000, 1234, 4321).
const pinObvio = (pin: string) => {
  const d = [...pin].map(Number);
  const paso = d[1] - d[0];
  return (
    Math.abs(paso) <= 1 && d.every((n, i) => i === 0 || n - d[i - 1] === paso)
  );
};

const enmascarar = (e164: string) =>
  `${e164.startsWith('+57') ? '+57 ' : ''}••• ••• ${e164.slice(-4)}`;

const withoutChildren = ({ children: _children, ...mandate }: MandateTree) =>
  mandate;

const pct = (a: Amount, p: number): Amount => ({
  ...a,
  value: String(Math.floor((Number(a.value) * p) / 100)),
});

// Como la api: los modos vivos de la persona dueña de la rama.
const modesOf = (id: string): { personaId: string; modes: ModeView[] } => {
  const node = findInTree(db.tree, id);
  const persona =
    node?.holderType === 'person'
      ? node
      : findInTree(db.tree, node?.parentId ?? '');
  const order = ['celular', 'asistente', 'sms'];
  const modes = (persona?.children ?? [])
    .filter((c) => c.mode && !c.revoked)
    .sort((a, b) => order.indexOf(a.mode!) - order.indexOf(b.mode!))
    .map((c) => ({
      mode: c.mode!,
      mandateId: c.id,
      maxDebit: c.maxDebit,
      remaining: {
        ...c.maxDebit,
        value: String(Number(c.maxDebit.value) - Number(c.spentInPeriod.value)),
      },
      offlineCap: c.offlineCap,
      pinThreshold: c.pinThreshold,
      frozen: c.frozen,
    }));
  return { personaId: persona?.id ?? id, modes };
};

const emit = (event: Omit<FeedEvent, 'id' | 'at'>) =>
  db.feed.unshift({
    id: `evt_${Date.now()}_${db.feed.length}`,
    at: new Date().toISOString(),
    ...event,
  });

type DelegateBody = {
  holderType: HolderType;
  holderId: string;
  holderName?: string;
  maxDebit: Amount;
  categories?: Category[];
  pinThreshold?: Amount;
  offlineCap?: Amount;
};

// Simula un pago del Asistente en vivo: debita en toda la cadena.
const simulatedEvent = (): FeedEvent => {
  const amount = usdAmount(0.01);
  pathTo('mnd_asistente').forEach((n) => {
    n.spentInPeriod = usdAmount(toNumber(n.spentInPeriod) + 0.01);
  });
  return {
    id: `evt_${Date.now()}`,
    at: new Date().toISOString(),
    mandateId: 'mnd_asistente',
    actor: { type: 'agent', name: 'Agente Asistente' },
    kind: 'agent_to_agent',
    amount,
    merchant: 'Agente de Inventario',
    reason: 'Consultó precios cerca de la vereda antes de proponer la compra.',
  };
};

const feedStreamHandler = () =>
  sse(apiUrl('/feed/stream'), ({ client, request }) => {
    // Al conectar, repite lo último; luego un movimiento nuevo cada 20 s.
    [...db.feed]
      .reverse()
      .forEach((event) =>
        client.send({ id: event.id, data: JSON.stringify(event) }),
      );
    const timer = setInterval(() => {
      const event = simulatedEvent();
      db.feed.unshift(event);
      client.send({ id: event.id, data: JSON.stringify(event) });
    }, 20_000);
    request.signal.addEventListener('abort', () => clearInterval(timer));
  });

export const mandatesHandlers = [
  // GET /feed — la libreta del árbol (lo más nuevo primero).
  http.get(apiUrl('/feed'), async () => {
    await networkDelay();
    return HttpResponse.json(db.feed);
  }),

  http.get(apiUrl('/demo/status'), async () => {
    await networkDelay();
    return HttpResponse.json({
      mockOp: true,
      mockSms: true,
      rootGrant: db.rootGrant,
      fxCopPerUsd: 4000,
      asset: {
        assetCode: db.tree.maxDebit.assetCode,
        assetScale: db.tree.maxDebit.assetScale,
      },
    });
  }),

  // Sin Test Wallet: "aprobar" es volver directo a /juan?ok=1.
  http.post(apiUrl('/mandates/root'), async ({ request }) => {
    await networkDelay();
    const body = (await request.json()) as {
      maxDebit?: Amount;
      interval?: string;
    };
    db.rootGrant = true;
    db.tree.revoked = false;
    db.tree.frozen = false;
    if (body.maxDebit) db.tree.maxDebit = body.maxDebit;
    if (body.interval) db.tree.interval = body.interval;
    emit({
      mandateId: db.tree.id,
      actor: { type: 'person', name: 'Juan' },
      kind: 'grant',
      amount: db.tree.maxDebit,
      reason: 'Juan aprobó el mandato raíz en su billetera.',
    });
    const origin =
      typeof window === 'undefined'
        ? 'http://localhost:5173'
        : window.location.origin;
    return HttpResponse.json({
      // Igual que src/api: vuelve a la ruta vieja /juan, que redirige a /cuenta
      redirectUrl: `${origin}${paths.legado.juan.path}?ok=1`,
    });
  }),

  http.post(
    apiUrl('/mandates/:mandateId/delegate'),
    async ({ params, request }) => {
      await networkDelay();
      const parent = findInTree(db.tree, String(params.mandateId));
      if (!parent) return notFound();
      if (parent.revoked) return fail('El mandato padre está revocado', 403);
      const body = (await request.json()) as DelegateBody;
      const siblings = parent.children
        .filter((c) => !c.revoked)
        .reduce((sum, c) => sum + toNumber(c.maxDebit), 0);
      if (siblings + toNumber(body.maxDebit) > toNumber(parent.maxDebit))
        return fail(
          'La suma de los sub-mandatos supera el tope del padre',
          403,
        );
      const categories = body.categories ?? parent.categories;
      const extra = categories.filter((c) => !parent.categories.includes(c));
      if (extra.length)
        return fail(
          `Categorías no permitidas por el padre: ${extra.join(', ')}`,
          403,
        );
      const child: MandateTree = {
        id: `m_${Date.now().toString(36)}`,
        parentId: parent.id,
        holderType: body.holderType,
        holderId: body.holderId,
        holderName: body.holderName ?? body.holderId,
        maxDebit: body.maxDebit,
        interval: parent.interval,
        spentInPeriod: usdAmount(0),
        categories,
        pinThreshold: body.pinThreshold,
        offlineCap: body.offlineCap,
        canSpend: true,
        expiresAt: parent.expiresAt,
        revoked: false,
        frozen: false,
        signature: `sig_${Date.now()}`,
        children: [],
      };
      parent.children.push(child);
      return HttpResponse.json(withoutChildren(child));
    },
  ),

  // El titular registra un beneficiario: persona (PIN siempre) + su celular (tope sin señal). Devuelve el código.
  http.post(
    apiUrl('/mandates/:mandateId/beneficiaries'),
    async ({ params, request }) => {
      await networkDelay();
      const root = findInTree(db.tree, String(params.mandateId));
      if (!root) return notFound();
      const body = (await request.json()) as {
        alias: string;
        maxDebit: MandateTree['maxDebit'];
        offlineCap: MandateTree['maxDebit'];
      };
      const used = root.children
        .filter((c) => !c.revoked)
        .reduce((sum, c) => sum + toNumber(c.maxDebit), 0);
      if (used + toNumber(body.maxDebit) > toNumber(root.maxDebit))
        return fail(
          'La suma de los sub-mandatos supera el tope del padre',
          403,
        );
      const id = `b_${Date.now().toString(36)}`;
      const base = {
        interval: root.interval,
        spentInPeriod: usdAmount(0),
        categories: root.categories,
        canSpend: true,
        expiresAt: root.expiresAt,
        revoked: false,
        frozen: false,
        signature: `sig_${Date.now()}`,
      };
      const offline =
        toNumber(body.offlineCap) > toNumber(pct(body.maxDebit, 40))
          ? body.offlineCap
          : pct(body.maxDebit, 40);
      const celular: MandateTree = {
        ...base,
        id: `${id}-cel`,
        parentId: id,
        holderType: 'device',
        holderId: `${id}-cel`,
        holderName: `Celular de ${body.alias}`,
        mode: 'celular',
        maxDebit: offline,
        offlineCap: body.offlineCap,
        children: [],
      };
      const agente = (mode: 'asistente' | 'sms', suffix: string) => ({
        ...base,
        id: `${id}-${suffix}`,
        parentId: id,
        holderType: 'agent' as const,
        holderId: 'asistente',
        holderName: `${mode === 'sms' ? 'SMS' : 'Asistente'} de ${body.alias}`,
        mode,
        maxDebit: pct(body.maxDebit, 20),
        pinThreshold: mode === 'sms' ? usdAmount(0) : undefined,
        children: [],
      });
      const persona: MandateTree = {
        ...base,
        id,
        parentId: root.id,
        holderType: 'person',
        holderId: id,
        holderName: body.alias,
        maxDebit: body.maxDebit,
        pinThreshold: usdAmount(0),
        children: [celular, agente('asistente', 'ag'), agente('sms', 'sms')],
      };
      root.children.push(persona);
      return HttpResponse.json(
        { code: celular.id, mandateId: id, modes: modesOf(id).modes },
        { status: 201 },
      );
    },
  ),

  http.get(apiUrl('/mandates/:mandateId/modes'), async ({ params }) => {
    await networkDelay();
    if (!findInTree(db.tree, String(params.mandateId))) return notFound();
    return HttpResponse.json(modesOf(String(params.mandateId)));
  }),

  http.post(
    apiUrl('/mandates/:mandateId/modes'),
    async ({ params, request }) => {
      await networkDelay();
      if (!request.headers.get('x-user-id'))
        return fail('Inicia sesión como titular', 401);
      if (!findInTree(db.tree, String(params.mandateId))) return notFound();
      return HttpResponse.json({
        created: [],
        ...modesOf(String(params.mandateId)),
      });
    },
  ),

  http.patch(
    apiUrl('/mandates/:mandateId/limits'),
    async ({ params, request }) => {
      await networkDelay();
      if (!request.headers.get('x-user-id'))
        return fail('Inicia sesión como titular', 401);
      const node = findInTree(db.tree, String(params.mandateId));
      const parent = node && findInTree(db.tree, node.parentId ?? '');
      if (!node || !parent) return notFound();
      const { maxDebit } = (await request.json()) as { maxDebit?: Amount };
      if (maxDebit) {
        const others = parent.children
          .filter((c) => !c.revoked && c.id !== node.id)
          .reduce((sum, c) => sum + toNumber(c.maxDebit), 0);
        if (others + toNumber(maxDebit) > toNumber(parent.maxDebit))
          return fail('Supera lo que queda por repartir', 403);
        node.maxDebit = maxDebit;
      }
      return HttpResponse.json(withoutChildren(node));
    },
  ),

  // SMS de una rama, con las mismas reglas que src/api (gateway/sms-canal.ts): solo el titular, E.164, PIN no obvio.
  http.get(apiUrl('/mandates/:mandateId/sms'), async ({ params, request }) => {
    await networkDelay();
    if (!request.headers.get('x-user-id'))
      return fail('Inicia sesión como titular', 401);
    const phone = db.sms[String(params.mandateId)];
    return HttpResponse.json(
      phone
        ? {
            active: true,
            phone: enmascarar(phone),
            mandateId: `sms_${String(params.mandateId)}`,
          }
        : { active: false },
    );
  }),

  http.put(apiUrl('/mandates/:mandateId/sms'), async ({ params, request }) => {
    await networkDelay();
    if (!request.headers.get('x-user-id'))
      return fail('Inicia sesión como titular', 401);
    const id = String(params.mandateId);
    if (!findInTree(db.tree, id)) return notFound();
    const body = (await request.json()) as { phone?: string; pin?: string };
    const phone = normalizarCelular(body.phone ?? '');
    if (!phone) return fail('Ese no parece un celular (ej. 300 111 2233)', 400);
    if (!/^\d{4}$/.test(body.pin ?? ''))
      return fail('El PIN son exactamente 4 números', 400);
    if (pinObvio(body.pin!))
      return fail('Ese PIN es muy fácil de adivinar', 400);
    const otra = Object.entries(db.sms).find(
      ([m, p]) => p === phone && m !== id,
    );
    if (otra)
      return fail('Ese número ya habla con el Asistente desde otra rama', 409);
    db.sms[id] = phone;
    return HttpResponse.json({
      active: true,
      phone: enmascarar(phone),
      mandateId: `sms_${id}`,
    });
  }),

  http.delete(
    apiUrl('/mandates/:mandateId/sms'),
    async ({ params, request }) => {
      await networkDelay();
      if (!request.headers.get('x-user-id'))
        return fail('Inicia sesión como titular', 401);
      const id = String(params.mandateId);
      if (!db.sms[id]) return fail('SMS de esta rama no existe', 404);
      delete db.sms[id];
      return HttpResponse.json({ active: false });
    },
  ),

  http.post(apiUrl('/mandates/:mandateId/unfreeze'), async ({ params }) => {
    await networkDelay();
    const node = findInTree(db.tree, String(params.mandateId));
    if (!node) return notFound();
    node.frozen = false;
    emit({
      mandateId: node.id,
      actor: { type: 'person', name: 'Juan' },
      kind: 'guardian',
      reason: `Juan descongeló a ${node.holderName}.`,
    });
    return HttpResponse.json(withoutChildren(node));
  }),

  http.get(apiUrl('/mandates/:mandateId/tree'), async ({ params }) => {
    await networkDelay();
    const node = findInTree(db.tree, String(params.mandateId));
    if (!node) return notFound();
    return HttpResponse.json(node);
  }),

  http.post(apiUrl('/mandates/:mandateId/revoke'), async ({ params }) => {
    await networkDelay();
    const node = findInTree(db.tree, String(params.mandateId));
    if (!node) return notFound();
    const revoked: string[] = [];
    cascade(node, (n) => {
      n.revoked = true;
      revoked.push(n.id);
    });
    // Revocar la raíz cancela el grant en el servidor de autorización.
    if (node.id === db.tree.id) db.rootGrant = false;
    emit({
      mandateId: node.id,
      actor: { type: 'person', name: 'Juan' },
      kind: 'revoked',
      reason: `Juan revocó la rama ${node.holderName}.`,
    });
    return HttpResponse.json({ revoked });
  }),

  http.patch(
    apiUrl('/mandates/:mandateId/restrict'),
    async ({ params, request }) => {
      await networkDelay();
      const node = findInTree(db.tree, String(params.mandateId));
      if (!node) return notFound();
      const body = (await request.json()) as {
        offlineCap?: Amount;
        frozen?: boolean;
      };
      if (body.frozen === false)
        return fail(
          'Restrict no puede descongelar: solo Juan (POST /mandates/:id/unfreeze)',
          403,
        );
      if (body.offlineCap) {
        const current = node.offlineCap ? toNumber(node.offlineCap) : 0;
        if (toNumber(body.offlineCap) > current)
          return fail(
            'Solo se puede bajar el tope. Ampliar exige firmar.',
            403,
          );
        node.offlineCap = body.offlineCap;
      }
      if (body.frozen) node.frozen = true;
      return HttpResponse.json(withoutChildren(node));
    },
  ),

  // jsdom no trae EventSource: en los tests el feed queda en 'unsupported'.
  ...(typeof EventSource === 'undefined' ? [] : [feedStreamHandler()]),
];
