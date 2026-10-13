import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { KitService } from "../src/api/kit.service";

describe("KitService (sin claves: modo degradado completo)", () => {
  it("salud parte en cero y la ingesta suma", async () => {
    const kit = new KitService();
    expect(kit.salud()).toEqual({ ok: true, fragmentos: 0 });

    const dir = mkdtempSync(join(tmpdir(), "kit-"));
    const doc = join(dir, "doc.txt");
    writeFileSync(doc, "Un documento con contenido suficiente para un fragmento.", "utf-8");

    const r = await kit.ingestar([doc]);
    expect(r.fragmentosNuevos).toBeGreaterThan(0);
    expect(kit.salud().fragmentos).toBe(r.fragmentosTotal);
  });

  it("consultar responde degradado con fuentes citables", async () => {
    const kit = new KitService();
    const dir = mkdtempSync(join(tmpdir(), "kit-"));
    const doc = join(dir, "reglamento.txt");
    writeFileSync(doc, "Los prestamos de equipos duran un maximo de 14 dias corridos.", "utf-8");
    await kit.ingestar([doc]);

    const r = await kit.consultar("plazo de los prestamos de equipos");
    expect(r.proveedor).toBe("reglas");
    expect(r.fuentes[0]).toContain("reglamento.txt#");
  });
});
