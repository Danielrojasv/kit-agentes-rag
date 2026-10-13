import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BusMemoria, evento } from "../src/nucleo/bus";

describe("BusMemoria", () => {
  it("publicar llega a los suscritos", () => {
    const bus = new BusMemoria();
    const recibidos: unknown[] = [];
    bus.suscribir("incidente", (e) => recibidos.push(e.datos));
    bus.publicar(evento("incidente", { id: "a" }));
    bus.publicar(evento("otro", { id: "b" }));
    expect(recibidos).toEqual([{ id: "a" }]);
  });

  it("guardar y leer", () => {
    const bus = new BusMemoria();
    bus.guardar("caso-1", { estado: "ejecutable" });
    expect(bus.leer("caso-1")).toEqual({ estado: "ejecutable" });
    expect(bus.leer("no-existe")).toBeUndefined();
  });

  it("avisar acumula", () => {
    const bus = new BusMemoria();
    bus.avisar("hola");
    expect(bus.avisos).toEqual(["hola"]);
  });

  it("registro append-only", () => {
    const ruta = join(mkdtempSync(join(tmpdir(), "kit-")), "registro.jsonl");
    const bus = new BusMemoria(ruta);
    bus.publicar(evento("a", { x: 1 }));
    bus.publicar(evento("b", { y: 2 }));
    const lineas = readFileSync(ruta, "utf-8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(lineas.map((l) => l.tipo)).toEqual(["a", "b"]);
  });
});
