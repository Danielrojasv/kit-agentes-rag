/**
 * Proveedores de embeddings.
 *
 * GeminiEmbeddings usa la API REST (requiere GEMINI_API_KEY). Para tests,
 * demos sin red y modo degradado existe EmbeddingsDeterministas: un hash
 * por palabra proyectado a un vector fijo. No captura semántica fina, pero
 * es determinista, gratis y suficiente para probar el circuito completo.
 */
import { createHash } from "node:crypto";

export interface Embeddings {
  vectorizar(textos: string[]): Promise<number[][]>;
}

export class EmbeddingsDeterministas implements Embeddings {
  constructor(readonly dimension = 256) {}

  async vectorizar(textos: string[]): Promise<number[][]> {
    return textos.map((t) => this.vector(t));
  }

  private vector(texto: string): number[] {
    const v = new Array<number>(this.dimension).fill(0);
    for (const palabra of texto.toLowerCase().split(/\s+/).filter(Boolean)) {
      const digesto = createHash("sha256").update(palabra, "utf-8").digest();
      const indice = digesto.readUInt32BE(0) % this.dimension;
      const signo = digesto[4] % 2 === 0 ? 1 : -1;
      v[indice] += signo;
    }
    const norma = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norma);
  }
}

export class GeminiEmbeddings implements Embeddings {
  static MODELO = "gemini-embedding-001";

  constructor(
    private apiKey = process.env.GEMINI_API_KEY ?? "",
    private timeoutMs = 30_000,
  ) {
    if (!this.apiKey) throw new Error("falta GEMINI_API_KEY para GeminiEmbeddings");
  }

  async vectorizar(textos: string[]): Promise<number[][]> {
    const modelo = GeminiEmbeddings.MODELO;
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${modelo}:batchEmbedContents?key=${this.apiKey}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: textos.map((t) => ({
          model: `models/${modelo}`,
          content: { parts: [{ text: t }] },
        })),
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!r.ok) throw new Error(`Gemini embeddings HTTP ${r.status}`);
    const datos = (await r.json()) as { embeddings: Array<{ values: number[] }> };
    return datos.embeddings.map((e) => e.values);
  }
}
