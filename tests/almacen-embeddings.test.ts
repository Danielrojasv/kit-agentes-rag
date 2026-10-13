import { describe, expect, it } from "vitest";

import { AlmacenMemoria } from "../src/nucleo/almacen";
import { EmbeddingsDeterministas } from "../src/nucleo/embeddings";
import type { Fragmento } from "../src/nucleo/fragmentos";

const fragmento = (texto: string, orden = 0): Fragmento => ({
  texto,
  fuente: "doc.txt",
  orden,
});

describe("embeddings y almacén", () => {
  it("embeddings deterministas son estables y normalizados", async () => {
    const emb = new EmbeddingsDeterministas(64);
    const [v1, v2] = await emb.vectorizar(["hola mundo", "hola mundo"]);
    expect(v1).toEqual(v2);
    expect(Math.abs(v1.reduce((s, x) => s + x * x, 0) - 1)).toBeLessThan(1e-6);
  });

  it("la búsqueda encuentra el fragmento más parecido", async () => {
    const emb = new EmbeddingsDeterministas(128);
    const textos = [
      "las facturas se emiten dentro de los primeros cinco dias del mes",
      "el menu del casino incluye porotos con riendas",
      "las notas de credito requieren aprobacion del supervisor",
    ];
    const frs = textos.map((t, i) => fragmento(t, i));
    const almacen = new AlmacenMemoria();
    await almacen.agregar(frs, await emb.vectorizar(textos));

    const [consulta] = await emb.vectorizar(["plazo para emitir las facturas del mes"]);
    const resultados = await almacen.buscar(consulta, 1);
    expect(resultados[0].fragmento.orden).toBe(0);
  });

  it("buscar respeta k", async () => {
    const emb = new EmbeddingsDeterministas(32);
    const frs = Array.from({ length: 10 }, (_, i) => fragmento(`texto ${i}`, i));
    const almacen = new AlmacenMemoria();
    await almacen.agregar(frs, await emb.vectorizar(frs.map((f) => f.texto)));
    const [v] = await emb.vectorizar(["texto"]);
    expect(await almacen.buscar(v, 3)).toHaveLength(3);
  });

  it("agregar exige que fragmentos y vectores calcen", async () => {
    const almacen = new AlmacenMemoria();
    await expect(almacen.agregar([fragmento("x")], [])).rejects.toThrow();
  });
});
