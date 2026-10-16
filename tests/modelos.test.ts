import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CadenaProveedores,
  ModoReglas,
  ProveedorOpenAICompatible,
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

describe("proveedor openai-compatible", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("exige base url y modelo", () => {
    expect(() => new ProveedorOpenAICompatible("", "key", "modelo")).toThrow("OPENAI_COMPAT_BASE_URL");
    expect(() => new ProveedorOpenAICompatible("https://gw.local/v1", "key", "")).toThrow(
      "OPENAI_COMPAT_MODELO",
    );
  });

  it("arma la petición chat/completions y parsea la respuesta", async () => {
    const llamadas: Array<[string, any]> = [];
    vi.stubGlobal("fetch", async (url: string, init: any) => {
      llamadas.push([url, JSON.parse(init.body)]);
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "hola" } }] }),
      };
    });

    const p = new ProveedorOpenAICompatible("https://gw.local/v1/", "la-key", "modelo-a");
    const r = await p.responder("eres util", "pregunta");

    expect(r).toEqual({ texto: "hola", proveedor: "openai-compatible:modelo-a" });
    const [url, cuerpo] = llamadas[0];
    expect(url).toBe("https://gw.local/v1/chat/completions");
    expect(cuerpo.model).toBe("modelo-a");
    expect(cuerpo.messages).toEqual([
      { role: "system", content: "eres util" },
      { role: "user", content: "pregunta" },
    ]);
  });

  it("un HTTP no ok se propaga y la cadena degrada a reglas", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 403, text: async () => "no auth" }));
    const cadena = new CadenaProveedores([
      new ProveedorOpenAICompatible("https://gw.local/v1", "key", "modelo-a"),
      new ModoReglas(),
    ]);
    const r = await cadena.responder("s", "m");
    expect(r.proveedor).toBe("reglas");
    expect(cadena.fallos[0][0]).toBe("openai-compatible:modelo-a");
    expect(cadena.fallos[0][1]).toContain("403");
  });
});
