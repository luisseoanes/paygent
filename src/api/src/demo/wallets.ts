// Wallet addresses públicas de la demo en el Test Wallet. Solo las usa la semilla: en la base viven en las tablas
// payers (quien delega) y merchants (quien recibe), y se dan de alta por la api sin tocar variables de entorno.
export const DEMO_WALLETS = {
  juan: 'https://ilp.interledger-test.dev/wallet-juan-usd',
  minimercado: 'https://ilp.interledger-test.dev/tienda-wallet',
  farmacia: 'https://ilp.interledger-test.dev/farmacia-san-jose-wallet',
  puntored: 'https://ilp.interledger-test.dev/puntored-efectivo-wallet',
  inventario: 'https://ilp.interledger-test.dev/agente-inventario-wallet',
} as const
