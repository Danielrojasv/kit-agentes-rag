/**
 * Almacén vectorial con dos adaptadores.
 *
 * AlmacenMemoria no necesita nada y sirve para tests, demo sin red y modo
 * degradado. AlmacenPgVector usa Postgres con la extensión pgvector (el
 * del docker-compose); `pg` se importa recién al usarlo.
 */
import type { Fragmento } from "./fragmentos";

export interface Resultado {
  fragmento: Fragmento;
  puntaje: number;
}

export interface Almacen {
  agregar(fragmentos: Fragmento[], vectores: number[][]): Promise<void>;
  buscar(vector: number[], k?: number): Promise<Resultado[]>;
}

function coseno(a: number[], b: number[]): number {
  let punto = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) punto += a[i] * b[i];
  const normaA = Math.sqrt(a.reduce((s, x) => s + x * x, 0)) || 1;
  const normaB = Math.sqrt(b.reduce((s, x) => s + x * x, 0)) || 1;
  return punto / (normaA * normaB);
}

export class AlmacenMemoria implements Almacen {
  private filas: Array<{ fragmento: Fragmento; vector: number[] }> = [];

  async agregar(fragmentos: Fragmento[], vectores: number[][]): Promise<void> {
    if (fragmentos.length !== vectores.length)
      throw new Error("fragmentos y vectores deben calzar");
    fragmentos.forEach((f, i) => this.filas.push({ fragmento: f, vector: vectores[i] }));
  }

  async buscar(vector: number[], k = 4): Promise<Resultado[]> {
    return this.filas
      .map((fila) => ({ fragmento: fila.fragmento, puntaje: coseno(vector, fila.vector) }))
      .sort((x, y) => y.puntaje - x.puntaje)
      .slice(0, k);
  }

  get tamano(): number {
    return this.filas.length;
  }
}

/**
 * Adaptador pgvector. Requiere `pnpm add pg` y el Postgres del
 * docker-compose (o cualquier Postgres con pgvector).
 */
export class AlmacenPgVector implements Almacen {
  private constructor(
    private pool: { query(sql: string, valores?: unknown[]): Promise<{ rows: any[] }> },
    private tabla: string,
  ) {}

  static async conectar(dsn: string, dimension: number, tabla = "fragmentos") {
    const { default: pg } = await import("pg"); // import tardío: dependencia opcional
    const pool = new pg.Pool({ connectionString: dsn });
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${tabla} (
        id SERIAL PRIMARY KEY,
        texto TEXT NOT NULL,
        fuente TEXT NOT NULL,
        orden INT NOT NULL,
        vector vector(${dimension}) NOT NULL
      )`,
    );
    return new AlmacenPgVector(pool, tabla);
  }

  async agregar(fragmentos: Fragmento[], vectores: number[][]): Promise<void> {
    if (fragmentos.length !== vectores.length)
      throw new Error("fragmentos y vectores deben calzar");
    for (let i = 0; i < fragmentos.length; i++) {
      const f = fragmentos[i];
      await this.pool.query(
        `INSERT INTO ${this.tabla} (texto, fuente, orden, vector) VALUES ($1, $2, $3, $4)`,
        [f.texto, f.fuente, f.orden, JSON.stringify(vectores[i])],
      );
    }
  }

  async buscar(vector: number[], k = 4): Promise<Resultado[]> {
    const v = JSON.stringify(vector);
    const { rows } = await this.pool.query(
      `SELECT texto, fuente, orden, 1 - (vector <=> $1::vector) AS puntaje
       FROM ${this.tabla} ORDER BY vector <=> $1::vector LIMIT $2`,
      [v, k],
    );
    return rows.map((fila) => ({
      fragmento: { texto: fila.texto, fuente: fila.fuente, orden: fila.orden },
      puntaje: Number(fila.puntaje),
    }));
  }
}
