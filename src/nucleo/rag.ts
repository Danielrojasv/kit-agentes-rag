/**
 * Consulta RAG: recuperar fragmentos, responder con citas obligatorias.
 *
 * La respuesta siempre lista sus fuentes (archivo y posición). Si el
 * almacén no tiene nada relevante, se dice explícitamente en vez de
 * inventar.
 */
import type { Almacen, Resultado } from "./almacen";
import type { Embeddings } from "./embeddings";
import type { Proveedor } from "./modelos";

export const SISTEMA =
  "Respondes solo con la información de los EXTRACTOS entregados. " +
  "Si los extractos no alcanzan para responder, dilo explícitamente. " +
  "Cita siempre la fuente entre corchetes, por ejemplo [reglamento.pdf#3]. " +
  "Responde en español, directo y sin relleno.";

export interface RespuestaRag {
  texto: string;
  proveedor: string;
  fuentes: string[];
  resultados: Resultado[];
}

export async function consultar(
  pregunta: string,
  embeddings: Embeddings,
  almacen: Almacen,
  proveedor: Proveedor,
  k = 4,
  umbral = 0.05,
): Promise<RespuestaRag> {
  const [vector] = await embeddings.vectorizar([pregunta]);
  const resultados = (await almacen.buscar(vector, k)).filter((r) => r.puntaje >= umbral);
  if (resultados.length === 0) {
    return {
      texto: "No hay material en la base para responder esta pregunta.",
      proveedor: "ninguno",
      fuentes: [],
      resultados: [],
    };
  }
  const extractos = resultados
    .map((r) => `[${r.fragmento.fuente}#${r.fragmento.orden}]\n${r.fragmento.texto}`)
    .join("\n\n");
  const respuesta = await proveedor.responder(
    SISTEMA,
    `EXTRACTOS:\n${extractos}\n\nPREGUNTA: ${pregunta}`,
  );
  return {
    texto: respuesta.texto,
    proveedor: respuesta.proveedor,
    fuentes: resultados.map((r) => `${r.fragmento.fuente}#${r.fragmento.orden}`),
    resultados,
  };
}
