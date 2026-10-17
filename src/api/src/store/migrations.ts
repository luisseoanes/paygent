import type { Sql } from './sql.ts'

// Esquema versionado: cada migración se aplica una sola vez (tabla schema_migrations). No se edita una
// migración ya desplegada: los cambios van en una nueva.
//
// Montos: los del árbol de mandatos van en columnas (valor entero en unidades mínimas + activo del mandato).
// Los que pueden estar en otra moneda (precio en COP, lo que recibió el comercio) van como jsonb { value, assetCode,
// assetScale }. Las fechas que firma el gateway (vigencia del mandato) van como texto ISO para que la firma se
// pueda verificar byte a byte.

const MIGRATIONS: { version: string; sql: string }[] = [
  {
    version: '001_modelo_inicial',
    sql: `
      -- Cuentas: quien delega (Juan) y quien recibe la delegación (María, Doña Carmen). El correo y la contraseña
      -- son opcionales para quien no usa la app (Doña Carmen solo tiene un celular de teclas).
      create table users (
        id text primary key,
        name text not null,
        document_type text not null default 'CC',
        document_number text not null unique,
        email text unique,
        password_salt text,
        password_hash text,
        phone text unique,
        created_at timestamptz not null default now()
      );

      -- Quien delega: su wallet pública. Nunca se guarda una llave suya; el permiso es el grant (root_grants).
      create table payers (
        user_id text primary key references users(id) on delete cascade,
        wallet_address text not null unique,
        asset_code text not null,
        asset_scale integer not null
      );

      create table agents (
        id text primary key,
        name text not null,
        role text not null check (role in ('assistant', 'inventory', 'guardian')),
        wallet_address text
      );

      -- Quien solo recibe: su dirección de cobro (la que firman los vales) y a dónde llega el dinero.
      create table merchants (
        id text primary key,
        name text not null,
        category text not null,
        wallet_address text not null unique,
        is_agent boolean not null default false,
        payout_via text check (payout_via in ('wallet', 'puntored')),
        payout_wallet text,
        payout_llave text,
        owner_user_id text references users(id) on delete set null
      );

      create table mandates (
        id text primary key,
        parent_id text references mandates(id) on delete cascade,
        holder_type text not null check (holder_type in ('person', 'device', 'agent')),
        holder_id text not null,
        holder_name text not null,
        holder_user_id text references users(id) on delete set null,
        asset_code text not null,
        asset_scale integer not null,
        max_debit numeric(40, 0) not null,
        spent_in_period numeric(40, 0) not null default 0,
        interval text not null,
        period_start text not null default '',
        categories text[] not null,
        pin_threshold numeric(40, 0),
        offline_cap numeric(40, 0),
        offline_cap_ceiling numeric(40, 0),
        can_spend boolean not null default true,
        expires_at text not null,
        revoked boolean not null default false,
        frozen boolean not null default false,
        signature text not null
      );
      create index mandates_parent on mandates(parent_id);

      -- El permiso de quien delega en su billetera (GNAP). pending → active; al volver a firmar, el anterior
      -- queda replaced; al revocar, revoked.
      create table root_grants (
        id text primary key,
        root_mandate_id text not null,
        payer_id text references payers(user_id) on delete set null,
        status text not null check (status in ('pending', 'active', 'replaced', 'revoked')),
        wallet_address text not null,
        max_debit jsonb not null,
        interval text not null,
        auth_server text,
        client_nonce text,
        finish_nonce text,
        continue_uri text not null,
        continue_token text not null,
        access_token text,
        manage_url text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index root_grants_root on root_grants(root_mandate_id, status);

      create table pins (
        mandate_id text primary key references mandates(id) on delete cascade,
        salt text not null,
        hash text not null
      );

      -- Por dónde habla cada persona con el Asistente: SMS (su número) o el chat de la app.
      create table profiles (
        channel text primary key,
        user_id text references users(id) on delete cascade,
        name text not null,
        mandate_id text not null references mandates(id) on delete cascade,
        data_mandate_id text not null references mandates(id) on delete cascade,
        lat double precision not null,
        lng double precision not null,
        root_id text not null,
        chat_for text
      );

      create table delivery_addresses (
        root_id text primary key references mandates(id) on delete cascade,
        recipient_name text not null,
        address text not null
      );

      create table device_keys (
        device_key_id text primary key,
        mandate_id text not null references mandates(id) on delete cascade,
        public_key text not null,
        unique (mandate_id, public_key)
      );

      create table device_certs (
        cert_id text primary key,
        device_key_id text not null references device_keys(device_key_id) on delete cascade,
        mandate_id text not null,
        cert jsonb not null
      );

      create table payments (
        id text primary key,
        mandate_id text not null references mandates(id) on delete cascade,
        merchant_wallet text not null,
        amount jsonb not null,
        price jsonb,
        receive_amount jsonb,
        category text not null,
        reason text not null,
        status text not null check (status in ('pending', 'completed', 'failed')),
        outgoing_payment_id text,
        delivery jsonb,
        payout jsonb,
        created_at timestamptz not null default now()
      );
      create index payments_merchant on payments(merchant_wallet);

      create table pending_purchases (
        id text primary key,
        mandate_id text not null references mandates(id) on delete cascade,
        merchant_wallet text not null,
        amount jsonb not null,
        price jsonb,
        category text not null,
        reason text not null,
        delivery jsonb,
        attempts integer not null default 0,
        expires_at timestamptz not null
      );

      -- Vales sin señal ya presentados: la clave es certificado + contador (detecta el doble gasto).
      create table vouchers (
        key text primary key,
        voucher jsonb not null,
        device_key_id text not null,
        mandate_id text not null,
        status text not null check (status in ('settled', 'rejected', 'flagged')),
        reason text,
        payment_id text,
        received_at timestamptz not null default now()
      );

      create table feed_events (
        seq bigint generated always as identity,
        id text primary key,
        at timestamptz not null default now(),
        mandate_id text not null,
        kind text not null,
        actor jsonb not null,
        amount jsonb,
        merchant text,
        reason text,
        delivery jsonb,
        payout jsonb
      );
      create index feed_events_seq on feed_events(seq);

      -- Llave ed25519 del gateway: firma mandatos y certificados. No se borra al resembrar la demo.
      create table gateway_keys (
        id text primary key,
        public_key text not null,
        secret_key text not null
      );

      create table meta (
        key text primary key,
        value text not null
      );
    `,
  },
  {
    version: '002_apellido_y_feed_por_raiz',
    sql: `
      alter table users add column last_name text;
      create index feed_events_mandate on feed_events(mandate_id);
    `,
  },
  {
    version: '003_modos_de_consumo',
    sql: `alter table mandates add column mode text check (mode in ('celular', 'asistente', 'sms'));`,
  },
  {
    // Intentos fallidos de PIN por mandato (no por compra): sin esto se prueban los 10.000 PIN pidiendo compras nuevas.
    version: '004_bloqueo_de_pin',
    sql: `
      alter table pins add column failed_attempts integer not null default 0;
      alter table pins add column locked_until timestamptz;
    `,
  },
  {
    // Un vale se reclama (processing) antes de pagarlo: dos cobros simultáneos del mismo vale ya no pagan dos veces.
    version: '005_vale_en_proceso',
    sql: `
      alter table vouchers drop constraint vouchers_status_check;
      alter table vouchers add constraint vouchers_status_check check (status in ('processing', 'settled', 'rejected', 'flagged'));
    `,
  },
]

export const migrate = async (sql: Sql) => {
  await sql.exec(`create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())`)
  const done = new Set((await sql.query<{ version: string }>(`select version from schema_migrations`)).map((r) => r.version))
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue
    await sql.tx(async (t) => {
      await t.exec(m.sql)
      await t.query(`insert into schema_migrations (version) values ($1)`, [m.version])
    })
    console.log(`[db] migración ${m.version} aplicada`)
  }
}
