/**
 * Esqueleto del flujo de agentes, sin dominio.
 *
 * Pipeline genérico de 4 pasos sobre el bus: clasificar → recuperar →
 * resolver → aprobación humana. El contenido de cada paso lo define cada
 * dominio; aquí viven el orden, los estados y la trazabilidad.
 *
 * Estados (patrón del humano al final, nunca autoejecutar):
 *   ejecutable        → listo para que un humano lo apruebe
 *   requiere_revision → el flujo no tuvo certeza; lo mira un humano
 *   bloqueada         → entrada inválida o insegura; queda registrada
 */
import type { Bus } from "./bus";
import { evento } from "./bus";

export const EJECUTABLE = "ejecutable";
export const REQUIERE_REVISION = "requiere_revision";
export const BLOQUEADA = "bloqueada";

const ESTADOS = new Set([EJECUTABLE, REQUIERE_REVISION, BLOQUEADA]);

export interface Caso {
  id: string;
  entrada: Record<string, unknown>;
  clasificacion?: string;
  contexto: string[];
  resolucion?: string;
  estado: string;
  traza: string[];
}

export function caso(id: string, entrada: Record<string, unknown>): Caso {
  return { id, entrada, contexto: [], estado: REQUIERE_REVISION, traza: [] };
}

export interface PasosFlujo {
  clasificar(c: Caso): Promise<string> | string;
  recuperar(c: Caso): Promise<string[]> | string[];
  resolver(c: Caso): Promise<[string, string]> | [string, string];
  validarEntrada?(entrada: Record<string, unknown>): boolean;
}

export class Flujo {
  constructor(
    private bus: Bus,
    private pasos: PasosFlujo,
  ) {}

  async procesar(c: Caso): Promise<Caso> {
    this.bus.publicar(evento("caso.recibido", { id: c.id }));
    const valida = this.pasos.validarEntrada ?? (() => true);
    if (!valida(c.entrada)) {
      c.estado = BLOQUEADA;
      c.traza.push("entrada inválida o insegura; bloqueada y registrada");
      this.bus.publicar(evento("caso.bloqueado", { id: c.id }));
      this.bus.avisar(`caso ${c.id} bloqueado`);
      return c;
    }

    c.clasificacion = await this.pasos.clasificar(c);
    c.traza.push(`clasificado como ${c.clasificacion}`);

    c.contexto = await this.pasos.recuperar(c);
    c.traza.push(`recuperados ${c.contexto.length} apoyos`);

    const [resolucion, estado] = await this.pasos.resolver(c);
    if (!ESTADOS.has(estado)) throw new Error(`estado desconocido: ${estado}`);
    c.resolucion = resolucion;
    c.estado = estado;
    c.traza.push(`resuelto con estado ${c.estado}`);

    this.bus.guardar(c.id, {
      clasificacion: c.clasificacion,
      resolucion: c.resolucion,
      estado: c.estado,
      traza: c.traza,
    });
    this.bus.publicar(evento("caso.resuelto", { id: c.id, estado: c.estado }));
    if (c.estado === EJECUTABLE) this.bus.avisar(`caso ${c.id} listo para aprobación humana`);
    return c;
  }
}
