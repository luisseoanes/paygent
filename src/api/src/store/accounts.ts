import { s, opt, clean, type Row, type Sql } from './rows.ts'

// Cuentas y quien delega (users, payers).

export interface User {
  id: string
  name: string
  documentType: string
  documentNumber: string
  lastName?: string
  email?: string
  phone?: string
}

export interface Payer {
  userId: string
  walletAddress: string
  assetCode: string
  assetScale: number
}

const toUser = (r: Row): User =>
  clean({
    id: r.id,
    name: r.name,
    lastName: opt(r.last_name),
    documentType: r.document_type,
    documentNumber: r.document_number,
    email: opt(r.email),
    phone: opt(r.phone),
  })

export const insertUser = async (
  u: User & { password?: { salt: string; hash: string } },
  conn?: Sql,
) => {
  await s(conn).query(
    `insert into users (id, name, document_type, document_number, email, password_salt, password_hash, phone, last_name)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [u.id, u.name, u.documentType, u.documentNumber, u.email ?? null, u.password?.salt ?? null, u.password?.hash ?? null, u.phone ?? null, u.lastName ?? null],
  )
}

export const getUserWithPassword = async (email: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from users where lower(email) = lower($1)`, [email])
  return r ? { user: toUser(r), salt: r.password_salt as string | null, hash: r.password_hash as string | null } : undefined
}

export const getUser = async (id: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from users where id = $1`, [id])
  return r ? toUser(r) : undefined
}

export const insertPayer = async (p: Payer, conn?: Sql) => {
  await s(conn).query(`insert into payers (user_id, wallet_address, asset_code, asset_scale) values ($1, $2, $3, $4)`, [
    p.userId,
    p.walletAddress,
    p.assetCode,
    p.assetScale,
  ])
}

export const getPayer = async (userId: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from payers where user_id = $1`, [userId])
  return r ? ({ userId: r.user_id, walletAddress: r.wallet_address, assetCode: r.asset_code, assetScale: r.asset_scale } as Payer) : undefined
}

export const setPayerAsset = async (userId: string, asset: { assetCode: string; assetScale: number }, conn?: Sql) => {
  await s(conn).query(`update payers set asset_code = $2, asset_scale = $3 where user_id = $1`, [userId, asset.assetCode, asset.assetScale])
}


/** Quien delega el mandato raíz: la cuenta titular de la raíz con su wallet (tabla payers). */
export const payerOfRoot = async (rootId: string, conn?: Sql) => {
  const [r] = await s(conn).query(
    `select p.* from payers p join mandates m on m.holder_user_id = p.user_id where m.id = $1`,
    [rootId],
  )
  return r ? ({ userId: r.user_id, walletAddress: r.wallet_address, assetCode: r.asset_code, assetScale: r.asset_scale } as Payer) : undefined
}

/** Lo que la sesión necesita de una cuenta: su raíz (titular) y sus ramas (beneficiario), la del celular primero. */
export const rootOfUser = async (userId: string, conn?: Sql) =>
  (await s(conn).query<{ id: string }>(`select id from mandates where holder_user_id = $1 and parent_id is null`, [userId]))[0]?.id

export const branchesOfUser = async (userId: string, conn?: Sql) =>
  (
    await s(conn).query<{ id: string }>(
      `select id from mandates where holder_user_id = $1 and parent_id is not null and not revoked
       order by (holder_type = 'device') desc, id`,
      [userId],
    )
  ).map((r) => r.id)

/** Una cuenta que ya usa ese correo, documento o celular. */
export const findDuplicateUser = async (email: string, documentNumber: string, phone: string, conn?: Sql) =>
  (
    await s(conn).query<{ email: string | null; document_number: string; phone: string | null }>(
      `select email, document_number, phone from users where lower(email) = lower($1) or document_number = $2 or phone = $3 limit 1`,
      [email, documentNumber, phone],
    )
  )[0]

export const walletTaken = async (walletAddress: string, conn?: Sql) =>
  (await s(conn).query(`select 1 from payers where wallet_address = $1`, [walletAddress])).length > 0

/** La cuenta dueña de un mandato y su celular (para conectar el modo SMS). */
export const holderContact = async (mandateId: string, conn?: Sql) =>
  (
    await s(conn).query<{ id: string | null; phone: string | null }>(
      `select u.id, u.phone from mandates m left join users u on u.id = m.holder_user_id where m.id = $1`,
      [mandateId],
    )
  )[0]

/** Borra las cuentas que ya no tienen rama, wallet de titular ni comercio. */
export const deleteOrphanUsers = async (userIds: string[], conn?: Sql) => {
  await s(conn).query(
    `delete from users u where u.id = any($1::text[])
       and not exists (select 1 from mandates m where m.holder_user_id = u.id)
       and not exists (select 1 from payers p where p.user_id = u.id)
       and not exists (select 1 from merchants s where s.owner_user_id = u.id)`,
    [userIds],
  )
}
