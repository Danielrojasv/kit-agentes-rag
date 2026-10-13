import { describe, expect, it } from "vitest";

import { fragmentar } from "../src/nucleo/fragmentos";

describe("fragmentar", () => {
  it("texto corto queda en un fragmento", () => {
    const frs = fragmentar("hola mundo", "doc.txt");
    expect(frs).toHaveLength(1);
    expect(frs[0].fuente).toBe("doc.txt");
    expect(frs[0].orden).toBe(0);
  });

  it("respeta el tope", () => {
    const texto = Array.from({ length: 20 }, (_, i) => `parrafo ${i} ` + "x".repeat(200)).join(
      "\n\n",
    );
    const frs = fragmentar(texto, "doc.txt", 500, 50);
    expect(frs.every((f) => f.texto.length <= 500)).toBe(true);
    expect(frs.length).toBeGreaterThan(1);
  });

  it("párrafo gigante se corta con solape", () => {
    const frs = fragmentar("a".repeat(3000), "doc.txt", 1000, 100);
    expect(frs.every((f) => f.texto.length <= 1000)).toBe(true);
    expect(frs.length).toBeGreaterThanOrEqual(3);
  });

  it("orden consecutivo", () => {
    const texto = Array.from({ length: 10 }, () => "parrafo " + "y".repeat(300)).join("\n\n");
    const frs = fragmentar(texto, "doc.txt", 400, 40);
    expect(frs.map((f) => f.orden)).toEqual(frs.map((_, i) => i));
  });

  it("parámetros inválidos revientan", () => {
    expect(() => fragmentar("x", "d", 0)).toThrow();
    expect(() => fragmentar("x", "d", 100, 100)).toThrow();
  });
});
