import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AlmacenMemoria } from "../src/nucleo/almacen";
import { EmbeddingsDeterministas } from "../src/nucleo/embeddings";
import type { Proveedor, RespuestaModelo } from "../src/nucleo/modelos";
import { MotorLangChain, MotorNucleo, crearMotor, type BaseMotor } from "../src/nucleo/motor";

class ProveedorEco implements Proveedor {
  readonly nombre = "eco";

  async responder(_sistema: string, mensaje: string): Promise<RespuestaModelo> {
    return { texto: mensaje, proveedor: this.nombre };
  }
}

function base(): BaseMotor {
  return {
    embeddings: new EmbeddingsDeterministas(128),
    almacen: new AlmacenMemoria(),
    proveedor: new ProveedorEco(),
  };
}

function documento(): string {
  const dir = mkdtempSync(join(tmpdir(), "kit-"));
  const doc = join(dir, "reglamento.txt");
  writeFileSync(doc, "Los prestamos de equipos duran un maximo de 14 dias corridos.", "utf-8");
  return doc;
}

describe("motores RAG", () => {
  it("el motor nucleo ingesta y consulta igual que el pipeline directo", async () => {
    const motor = new MotorNucleo(base());
    const n = await motor.ingestar([documento()]);
    expect(n).toBeGreaterThan(0);

    const r = await motor.consultar("plazo de los prestamos de equipos", 2);
    expect(r.motor).toBe("nucleo");
    expect(r.proveedor).toBe("eco");
    expect(r.fuentes[0]).toContain("reglamento.txt#");
  });

  it("el motor langchain degrada al nucleo y lo dice", async () => {
    const motor = new MotorLangChain(base());
    await motor.ingestar([documento()]);

    const r = await motor.consultar("plazo de los prestamos de equipos", 2);
    expect(r.motor).toContain("degradado desde langchain");
    expect(r.fuentes[0]).toContain("reglamento.txt#");
    expect(r.texto).toContain("prestamos");
  });

  it("crearMotor: default nucleo, langchain explicito, desconocido revienta", () => {
    expect(crearMotor(undefined, base())).toBeInstanceOf(MotorNucleo);
    expect(crearMotor("", base())).toBeInstanceOf(MotorNucleo);
    expect(crearMotor("nucleo", base())).toBeInstanceOf(MotorNucleo);
    expect(crearMotor("langchain", base())).toBeInstanceOf(MotorLangChain);
    expect(() => crearMotor("llamaindex", base())).toThrow("motor desconocido");
  });
});
