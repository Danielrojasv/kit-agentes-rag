/**
 * Ingesta de documentos: archivo → texto → fragmentos → vectores → almacén.
 *
 * Soporta .txt y .md nativo; .pdf requiere pdf-parse (dependencia
 * opcional, import tardío con error claro).
 */
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import type { Almacen } from "./almacen";
import type { Embeddings } from "./embeddings";
import { fragmentar } from "./fragmentos";

export async function extraerTexto(ruta: string): Promise<string> {
  const sufijo = extname(ruta).toLowerCase();
  if (sufijo === ".txt" || sufijo === ".md") return readFile(ruta, "utf-8");
  if (sufijo === ".pdf") {
    let pdfParse: (b: Buffer) => Promise<{ text: string }>;
    try {
      pdfParse = (await import("pdf-parse")).default as any;
    } catch {
      throw new Error("para PDF instala pdf-parse: pnpm add pdf-parse");
    }
    const { text } = await pdfParse(await readFile(ruta));
    return text;
  }
  throw new Error(`formato no soportado: ${sufijo}`);
}

/** Ingesta las rutas dadas. Devuelve cuántos fragmentos entraron. */
export async function ingestar(
  rutas: string[],
  embeddings: Embeddings,
  almacen: Almacen,
  tope = 1200,
  solape = 150,
): Promise<number> {
  let total = 0;
  for (const ruta of rutas) {
    const texto = await extraerTexto(ruta);
    const fragmentos = fragmentar(texto, basename(ruta), tope, solape);
    if (fragmentos.length === 0) continue;
    const vectores = await embeddings.vectorizar(fragmentos.map((f) => f.texto));
    await almacen.agregar(fragmentos, vectores);
    total += fragmentos.length;
  }
  return total;
}
