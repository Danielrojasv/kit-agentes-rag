import { describe, expect, it } from "vitest";

import {
  CadenaProveedores,
  ModoReglas,
  type Proveedor,
  type RespuestaModelo,
} from "../src/nucleo/modelos";

class ProveedorQueFalla implements Proveedor {
  readonly nombre = "falla";

  async responder(): Promise<RespuestaModelo> {
    throw new Error("sin red");
  }
}

class ProveedorFijo implements Proveedor {
  readonly nombre = "fijo";

  constructor(private texto = "ok") {}

  async responder(): Promise<RespuestaModelo> {
    return { texto: this.texto, proveedor: this.nombre };
  }
}

describe("proveedores", () => {
  it("modo reglas siempre responde", async () => {
    const r = await new ModoReglas().responder("sistema", "cualquier cosa");
    expect(r.proveedor).toBe("reglas");
    expect(r.texto).toContain("degradado");
  });

  it("modo reglas con función del dominio", async () => {
    const reglas = new ModoReglas((m) => (m.includes("error") ? "soporte" : "normal"));
    expect((await reglas.responder("s", "aparecio un error")).texto).toBe("soporte");
  });

  it("la cadena cae al siguiente y registra el fallo", async () => {
    const cadena = new CadenaProveedores([new ProveedorQueFalla(), new ProveedorFijo("respuesta b")]);
    const r = await cadena.responder("s", "m");
    expect(r.texto).toBe("respuesta b");
    expect(cadena.fallos[0][0]).toBe("falla");
  });

  it("la cadena con reglas al final nunca revienta", async () => {
    const cadena = new CadenaProveedores([new ProveedorQueFalla(), new ModoReglas()]);
    expect((await cadena.responder("s", "m")).proveedor).toBe("reglas");
  });

  it("cadena vacía es error", () => {
    expect(() => new CadenaProveedores([])).toThrow();
  });

  it("si todos fallan revienta con claridad", async () => {
    const cadena = new CadenaProveedores([new ProveedorQueFalla()]);
    await expect(cadena.responder("s", "m")).rejects.toThrow("ningún proveedor");
  });
});
