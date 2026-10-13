/**
 * Servicio que arma el núcleo según el entorno.
 *
 * Sin claves: embeddings deterministas, almacén en memoria y modo reglas
 * (el kit corre igual, degradado y lo dice). Con claves: Gemini para
 * embeddings y la cadena Claude → Gemini → reglas.
 */
import { Injectable } from "@nestjs/common";

import {
  Almacen,
  AlmacenMemoria,
  CadenaProveedores,
  ClaudeProveedor,
  Embeddings,
  EmbeddingsDeterministas,
  GeminiEmbeddings,
  GeminiProveedor,
  ModoReglas,
  Proveedor,
  RespuestaRag,
  consultar,
  ingestar,
} from "../nucleo";

@Injectable()
export class KitService {
  private readonly embeddings: Embeddings;
  private readonly almacen: AlmacenMemoria;
  private readonly proveedor: Proveedor;
  private fragmentos = 0;

  constructor() {
    const proveedores: Proveedor[] = [];
    if (process.env.ANTHROPIC_API_KEY) proveedores.push(new ClaudeProveedor());
    if (process.env.GEMINI_API_KEY) proveedores.push(new GeminiProveedor());
    proveedores.push(new ModoReglas());

    this.embeddings = process.env.GEMINI_API_KEY
      ? new GeminiEmbeddings()
      : new EmbeddingsDeterministas();
    this.almacen = new AlmacenMemoria();
    this.proveedor = new CadenaProveedores(proveedores);
  }

  salud(): { ok: boolean; fragmentos: number } {
    return { ok: true, fragmentos: this.fragmentos };
  }

  async ingestar(rutas: string[]): Promise<{ fragmentosNuevos: number; fragmentosTotal: number }> {
    const n = await ingestar(rutas, this.embeddings, this.almacen);
    this.fragmentos += n;
    return { fragmentosNuevos: n, fragmentosTotal: this.fragmentos };
  }

  async consultar(pregunta: string, k = 4): Promise<RespuestaRag> {
    return consultar(pregunta, this.embeddings, this.almacen, this.proveedor, k);
  }
}
