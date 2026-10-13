import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AlmacenMemoria } from "../src/nucleo/almacen";
import { EmbeddingsDeterministas } from "../src/nucleo/embeddings";
import { extraerTexto, ingestar } from "../src/nucleo/ingesta";
import type { Proveedor, RespuestaModelo } from "../src/nucleo/modelos";
import { consultar } from "../src/nucleo/rag";

/** Devuelve el mensaje recibido; sirve para inspeccionar el prompt. */
class ProveedorEco implements Proveedor {
  readonly nombre = "eco";

  async responder(_sistema: string, mensaje: string): Promise<RespuestaModelo> {
    return { texto: mensaje, proveedor: this.nombre };
  }
}

async function base() {
  const dir = mkdtempSync(join(tmpdir(), "kit-"));
  const doc = join(dir, "reglamento.txt");
  writeFileSync(
    doc,
    "Los prestamos de equipos duran un maximo de 14 dias corridos.\n\n" +
      "Las devoluciones atrasadas generan un bloqueo temporal de la cuenta.\n\n" +
      "Cada retiro queda registrado en la bitacora de la bodega.",
    "utf-8",
  );
  const emb = new EmbeddingsDeterministas(128);
  const almacen = new AlmacenMemoria();
  const n = await ingestar([doc], emb, almacen, 200, 20);
  return { emb, almacen, n };
}

describe("ingesta y RAG", () => {
  it("la ingesta cuenta fragmentos", async () => {
    const { almacen, n } = await base();
    expect(n).toBe(almacen.tamano);
    expect(n).toBeGreaterThan(0);
  });

  it("la consulta trae fuentes y extractos", async () => {
    const { emb, almacen } = await base();
    const r = await consultar("plazo de los prestamos de equipos", emb, almacen, new ProveedorEco(), 2);
    expect(r.proveedor).toBe("eco");
    expect(r.fuentes.length).toBeGreaterThan(0);
    expect(r.fuentes.every((f) => f.startsWith("reglamento.txt#"))).toBe(true);
    expect(r.texto).toContain("EXTRACTOS");
    expect(r.texto).toContain("prestamos");
  });

  it("sin material no inventa", async () => {
    const emb = new EmbeddingsDeterministas(128);
    const almacen = new AlmacenMemoria();
    const r = await consultar("cualquier cosa", emb, almacen, new ProveedorEco());
    expect(r.proveedor).toBe("ninguno");
    expect(r.fuentes).toEqual([]);
    expect(r.texto).toContain("No hay material");
  });

  it("formato no soportado revienta", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kit-"));
    const raro = join(dir, "datos.xyz");
    writeFileSync(raro, "x");
    await expect(extraerTexto(raro)).rejects.toThrow("formato no soportado");
  });
});
