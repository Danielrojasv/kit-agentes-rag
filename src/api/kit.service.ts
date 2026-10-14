/**
 * Servicio que arma el núcleo según el entorno.
 *
 * Sin claves: embeddings deterministas, almacén en memoria y modo reglas
 * (el kit corre igual, degradado y lo dice). Con claves: Gemini para
 * embeddings y la cadena Claude → Gemini → reglas.
 *
 * El motor RAG se elige con MOTOR_RAG (nucleo | langchain, default
 * nucleo); la API solo conoce la interfaz MotorRag.
 */
import { Injectable } from "@nestjs/common";

import {
  AlmacenMemoria,
  CadenaProveedores,
  ClaudeProveedor,
  Embeddings,
  EmbeddingsDeterministas,
  GeminiEmbeddings,
  GeminiProveedor,
  ModoReglas,
  MotorRag,
  Proveedor,
  RespuestaRag,
  crearMotor,
} from "../nucleo";

@Injectable()
export class KitService {
  private readonly motor: MotorRag;
  private fragmentos = 0;

  constructor() {
    const proveedores: Proveedor[] = [];
    if (process.env.ANTHROPIC_API_KEY) proveedores.push(new ClaudeProveedor());
    if (process.env.GEMINI_API_KEY) proveedores.push(new GeminiProveedor());
    proveedores.push(new ModoReglas());

    const embeddings: Embeddings = process.env.GEMINI_API_KEY
      ? new GeminiEmbeddings()
      : new EmbeddingsDeterministas();

    this.motor = crearMotor(process.env.MOTOR_RAG, {
      embeddings,
      almacen: new AlmacenMemoria(),
      proveedor: new CadenaProveedores(proveedores),
    });
  }

  salud(): { ok: boolean; fragmentos: number; motor: string } {
    return { ok: true, fragmentos: this.fragmentos, motor: this.motor.nombre };
  }

  async ingestar(rutas: string[]): Promise<{ fragmentosNuevos: number; fragmentosTotal: number }> {
    const n = await this.motor.ingestar(rutas);
    this.fragmentos += n;
    return { fragmentosNuevos: n, fragmentosTotal: this.fragmentos };
  }

  async consultar(pregunta: string, k = 4): Promise<RespuestaRag> {
    return this.motor.consultar(pregunta, k);
  }
}
