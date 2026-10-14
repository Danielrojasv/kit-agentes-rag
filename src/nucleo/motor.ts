/**
 * Motor RAG intercambiable: la API habla con esta interfaz y no sabe qué
 * implementación hay detrás.
 *
 * MotorNucleo envuelve el pipeline propio del kit. MotorLangChain es el
 * enchufe para LangChain como dependencia opcional (import tardío, mismo
 * patrón que pdf-parse y pg): mientras la librería no esté instalada o la
 * implementación no exista, degrada al núcleo y lo dice en la respuesta.
 */
import type { Almacen } from "./almacen";
import type { Embeddings } from "./embeddings";
import { ingestar } from "./ingesta";
import type { Proveedor } from "./modelos";
import { consultar, type RespuestaRag } from "./rag";

export interface MotorRag {
  readonly nombre: string;
  ingestar(rutas: string[]): Promise<number>;
  consultar(pregunta: string, k?: number): Promise<RespuestaRag>;
}

/** Piezas del núcleo con las que se arma cualquier motor. */
export interface BaseMotor {
  embeddings: Embeddings;
  almacen: Almacen;
  proveedor: Proveedor;
}

export class MotorNucleo implements MotorRag {
  readonly nombre = "nucleo";

  constructor(private readonly base: BaseMotor) {}

  ingestar(rutas: string[]): Promise<number> {
    return ingestar(rutas, this.base.embeddings, this.base.almacen);
  }

  async consultar(pregunta: string, k = 4): Promise<RespuestaRag> {
    const r = await consultar(
      pregunta,
      this.base.embeddings,
      this.base.almacen,
      this.base.proveedor,
      k,
    );
    return { ...r, motor: this.nombre };
  }
}

export class MotorLangChain implements MotorRag {
  readonly nombre = "langchain";
  private readonly respaldo: MotorNucleo;

  constructor(base: BaseMotor) {
    this.respaldo = new MotorNucleo(base);
  }

  /** Por qué este motor aún no opera por sí mismo. */
  private async motivoDegradado(): Promise<string> {
    try {
      await import("@langchain/core");
    } catch {
      return "libreria no instalada (pnpm add langchain @langchain/core)";
    }
    return "implementacion pendiente";
  }

  // La ingesta con LangChain (loaders y splitters propios) llegará junto
  // con la implementación real; mientras tanto ingesta el núcleo.
  ingestar(rutas: string[]): Promise<number> {
    return this.respaldo.ingestar(rutas);
  }

  async consultar(pregunta: string, k = 4): Promise<RespuestaRag> {
    const motivo = await this.motivoDegradado();
    const r = await this.respaldo.consultar(pregunta, k);
    return { ...r, motor: `nucleo (degradado desde langchain: ${motivo})` };
  }
}

export const MOTORES = ["nucleo", "langchain"] as const;
export type TipoMotor = (typeof MOTORES)[number];

/** Arma el motor pedido; sin tipo (o vacío) entrega el núcleo. */
export function crearMotor(tipo: string | undefined, base: BaseMotor): MotorRag {
  const elegido = tipo?.trim() || "nucleo";
  if (elegido === "nucleo") return new MotorNucleo(base);
  if (elegido === "langchain") return new MotorLangChain(base);
  throw new Error(`motor desconocido: ${elegido} (opciones: ${MOTORES.join(", ")})`);
}
