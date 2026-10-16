import { type Category, type MandateNode, type Payee } from '../types/paygent';

// Datos de la demo (BRAND.md §8 y blueprint §3.1). Todos los montos COP son
// ilustrativos y van marcados SIMULADO en la UI.

export const COP_PER_USD = 4000;
export const DEMO_PIN = '1234';
export const JUAN_WALLET = '$ilp.interledger-test.dev/juan';

export const toCop = (usd: number) => Math.round(usd * COP_PER_USD);
export const toUsd = (cop: number) =>
  Math.round((cop / COP_PER_USD) * 100) / 100;

export const payees = {
  farmacia: {
    id: 'farmacia',
    name: 'Farmacia San José',
    walletAddress: '$ilp.interledger-test.dev/farmacia-san-jose',
  },
  tienda: {
    id: 'tienda',
    name: 'Tienda de don Abel',
    walletAddress: '$ilp.interledger-test.dev/tienda-don-abel',
  },
  inventario: {
    id: 'inventario',
    name: 'Agente de Inventario · Puntored',
    walletAddress: '$ilp.interledger-test.dev/inventario-puntored',
  },
  puntored: {
    id: 'puntored',
    name: 'Punto Puntored · efectivo',
    walletAddress: '$ilp.interledger-test.dev/puntored-vereda',
  },
} satisfies Record<string, Payee>;

export const categoryLabels: Record<Category, string> = {
  mercado: 'Mercado',
  farmacia: 'Farmacia',
  efectivo: 'Efectivo',
  consulta: 'Consulta',
};

export const createDemoTree = (): Record<string, MandateNode> => {
  const nodes: MandateNode[] = [
    {
      id: 'root',
      parentId: null,
      kind: 'root',
      name: 'Mandato raíz',
      label: 'Raíz · Juan',
      holder: 'Juan, en Texas',
      limit: 300,
      signedLimit: 300,
      interval: 'mes',
      spent: 0,
      categories: ['mercado', 'farmacia', 'efectivo', 'consulta'],
      status: 'active',
    },
    {
      id: 'maria',
      parentId: 'root',
      kind: 'person',
      name: 'María',
      label: 'Rama · persona',
      holder: 'María, cuidadora',
      limit: 250,
      signedLimit: 250,
      interval: 'mes',
      spent: 0,
      categories: ['mercado', 'farmacia', 'efectivo'],
      status: 'active',
    },
    {
      id: 'maria-key',
      parentId: 'maria',
      kind: 'device-key',
      name: 'Llave del celular',
      label: 'Hoja · sin señal',
      holder: 'Celular de María',
      limit: 250,
      signedLimit: 250,
      interval: 'offline',
      spent: 0,
      categories: ['mercado', 'farmacia', 'efectivo'],
      status: 'active',
      offlineLimit: 20,
      offlineCeiling: 50,
    },
    {
      id: 'rosa-pin',
      parentId: 'maria',
      kind: 'sms-pin',
      name: 'PIN SMS',
      label: 'Hoja · SMS',
      holder: 'Doña Rosa, celular de teclas',
      limit: 50,
      signedLimit: 50,
      interval: 'compra',
      spent: 0,
      categories: ['mercado', 'farmacia', 'efectivo'],
      status: 'active',
      pinRequired: true,
    },
    {
      id: 'asistente',
      parentId: 'root',
      kind: 'agent',
      name: 'Agente Asistente',
      label: 'Rama · agente',
      holder: 'Asistente de Doña Rosa',
      limit: 40,
      signedLimit: 40,
      interval: 'semana',
      spent: 0,
      categories: ['farmacia', 'mercado'],
      status: 'active',
      pinRequired: true,
      pinOver: 10,
    },
    {
      id: 'inventario',
      parentId: 'asistente',
      kind: 'agent',
      name: 'Agente de Inventario',
      label: 'Hoja · agente a agente',
      holder: 'Pago por consulta',
      limit: 0.5,
      signedLimit: 0.5,
      interval: 'mes',
      spent: 0,
      categories: ['consulta'],
      status: 'active',
    },
    {
      id: 'guardian',
      parentId: 'root',
      kind: 'guardian',
      name: 'Agente Guardián',
      label: 'Rama · guardián',
      holder: 'No gasta: solo restringe',
      limit: 0,
      signedLimit: 0,
      interval: 'ninguno',
      spent: 0,
      categories: [],
      status: 'active',
    },
  ];
  return Object.fromEntries(nodes.map((node) => [node.id, node]));
};

// Catálogo sintético del Agente de Inventario (el pago por consultarlo es real).
export const inventoryCatalog = [
  {
    keywords: ['presion', 'presión', 'losartan', 'losartán', 'pastilla'],
    product: 'Losartán 50 mg',
    need: 'medicamento para la presión arterial',
    offers: [
      { payee: payees.farmacia, priceCop: 12000, distance: '3 cuadras' },
      {
        payee: {
          id: 'drogueria',
          name: 'Droguería La Esperanza',
          walletAddress: '$ilp.interledger-test.dev/drogueria-esperanza',
        },
        priceCop: 14500,
        distance: '1,2 km',
      },
    ],
    category: 'farmacia' as Category,
  },
  {
    keywords: ['arroz', 'mercado', 'leche', 'panela', 'huevos'],
    product: 'Mercado básico (arroz, panela, huevos)',
    need: 'mercado de la semana',
    offers: [{ payee: payees.tienda, priceCop: 26000, distance: '2 cuadras' }],
    category: 'mercado' as Category,
  },
];

export const INVENTORY_FEE_USD = 0.01;
