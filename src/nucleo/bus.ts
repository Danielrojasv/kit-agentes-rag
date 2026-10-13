/**
 * Bus de eventos portable.
 *
 * La interfaz que usa todo el kit: publicar, suscribir, guardar, avisar.
 * Cada despliegue elige el adaptador según la capa disponible
 * (EventGrid, FunctionGraph+SMN, Docker en ECS, o este bus en memoria).
 */
import { appendFileSync } from "node:fs";

export interface Evento {
  tipo: string;
  datos: Record<string, unknown>;
  ts: number;
}

export function evento(tipo: string, datos: Record<string, unknown>): Evento {
  return { tipo, datos, ts: Date.now() / 1000 };
}

export interface Bus {
  publicar(e: Evento): void;
  suscribir(tipo: string, handler: (e: Evento) => void): void;
  guardar(clave: string, valor: Record<string, unknown>): void;
  avisar(mensaje: string): void;
}

/** Adaptador en memoria. Sirve para tests y para el modo degradado. */
export class BusMemoria implements Bus {
  avisos: string[] = [];
  eventos: Evento[] = [];
  private handlers = new Map<string, Array<(e: Evento) => void>>();
  private almacen = new Map<string, Record<string, unknown>>();

  constructor(private rutaRegistro?: string) {}

  publicar(e: Evento): void {
    this.eventos.push(e);
    this.registrar({ tipo: e.tipo, datos: e.datos, ts: e.ts });
    for (const handler of this.handlers.get(e.tipo) ?? []) handler(e);
  }

  suscribir(tipo: string, handler: (e: Evento) => void): void {
    const lista = this.handlers.get(tipo) ?? [];
    lista.push(handler);
    this.handlers.set(tipo, lista);
  }

  guardar(clave: string, valor: Record<string, unknown>): void {
    this.almacen.set(clave, valor);
  }

  leer(clave: string): Record<string, unknown> | undefined {
    return this.almacen.get(clave);
  }

  avisar(mensaje: string): void {
    this.avisos.push(mensaje);
  }

  private registrar(linea: Record<string, unknown>): void {
    // Trazabilidad: cada evento queda en un registro append-only.
    if (!this.rutaRegistro) return;
    appendFileSync(this.rutaRegistro, JSON.stringify(linea) + "\n", "utf-8");
  }
}
