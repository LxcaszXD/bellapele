import type {
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
} from "mysql2/promise";
import { db } from "../db";
export type Connection = PoolConnection;
export type Row = Record<string, string | number | null>;
export async function rows(
  c: Connection,
  sql: string,
  values: unknown[] = [],
): Promise<Row[]> {
  const [r] = await c.query<RowDataPacket[]>(sql, values);
  return r as Row[];
}
export async function exec(c: Connection, sql: string, values: unknown[] = []) {
  const [r] = await c.query<ResultSetHeader>(sql, values);
  return r;
}
export async function transaction<T>(
  fn: (c: Connection) => Promise<T>,
): Promise<T> {
  const c = await db().getConnection();
  try {
    await c.query("SET time_zone='+00:00'");
    await c.beginTransaction();
    const result = await fn(c);
    await c.commit();
    return result;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function lock(c: Connection) {
  await rows(c, "SELECT id FROM ControleAgenda WHERE id=1 FOR UPDATE");
}
export async function audit(
  c: Connection,
  user: number,
  action: string,
  resource: string,
  id: number | null,
) {
  await exec(
    c,
    "INSERT INTO Auditoria(id_usuario,acao,recurso,id_registro) VALUES(?,?,?,?)",
    [user || null, action, resource, id],
  );
}
