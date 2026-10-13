import { describe, expect, it } from "vitest";

import { BusMemoria } from "../src/nucleo/bus";
import {
  BLOQUEADA,
  Caso,
  EJECUTABLE,
  Flujo,
  REQUIERE_REVISION,
  caso,
} from "../src/nucleo/flujo";

function flujo(bus: BusMemoria, estadoFinal: string = EJECUTABLE): Flujo {
  return new Flujo(bus, {
    clasificar: () => "tipo-a",
    recuperar: () => ["apoyo 1", "apoyo 2"],
    resolver: (): [string, string] => ["resolucion de prueba", estadoFinal],
    validarEntrada: (entrada) => (entrada.texto as string) !== "",
  });
}

describe("flujo", () => {
  it("caso feliz queda ejecutable y trazado", async () => {
    const bus = new BusMemoria();
    const c: Caso = await flujo(bus).procesar(caso("c1", { texto: "hola" }));
    expect(c.estado).toBe(EJECUTABLE);
    expect(c.clasificacion).toBe("tipo-a");
    expect(c.traza).toHaveLength(3);
    expect(bus.leer("c1")?.estado).toBe(EJECUTABLE);
    expect(bus.avisos.some((a) => a.includes("aprobación humana"))).toBe(true);
    expect(bus.eventos.map((e) => e.tipo)).toEqual(["caso.recibido", "caso.resuelto"]);
  });

  it("entrada inválida se bloquea y registra", async () => {
    const bus = new BusMemoria();
    const c = await flujo(bus).procesar(caso("c2", { texto: "" }));
    expect(c.estado).toBe(BLOQUEADA);
    expect(c.clasificacion).toBeUndefined();
    expect(bus.eventos.map((e) => e.tipo)).toEqual(["caso.recibido", "caso.bloqueado"]);
  });

  it("requiere_revision no avisa aprobación", async () => {
    const bus = new BusMemoria();
    const c = await flujo(bus, REQUIERE_REVISION).procesar(caso("c3", { texto: "x" }));
    expect(c.estado).toBe(REQUIERE_REVISION);
    expect(bus.avisos).toEqual([]);
  });

  it("estado desconocido revienta", async () => {
    const bus = new BusMemoria();
    await expect(flujo(bus, "inventado").procesar(caso("c4", { texto: "x" }))).rejects.toThrow(
      "estado desconocido",
    );
  });
});
