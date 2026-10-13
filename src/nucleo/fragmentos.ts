/**
 * Fragmentador de texto para RAG, sin dependencias.
 *
 * Corta por párrafos respetando un tope de caracteres, con solape para no
 * perder contexto en los bordes. Cada fragmento conserva su fuente.
 */

export interface Fragmento {
  texto: string;
  fuente: string;
  orden: number;
}

export function fragmentar(
  texto: string,
  fuente: string,
  tope = 1200,
  solape = 150,
): Fragmento[] {
  if (tope <= 0) throw new Error("el tope debe ser positivo");
  if (solape >= tope) throw new Error("el solape debe ser menor que el tope");

  const parrafos = texto
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const fragmentos: Fragmento[] = [];
  let actual = "";

  const cerrar = (bloque: string): void => {
    const limpio = bloque.trim();
    if (limpio) fragmentos.push({ texto: limpio, fuente, orden: fragmentos.length });
  };

  for (const parrafo of parrafos) {
    if (parrafo.length > tope) {
      // Párrafo gigante: se corta duro con solape.
      cerrar(actual);
      actual = "";
      let inicio = 0;
      while (inicio < parrafo.length) {
        cerrar(parrafo.slice(inicio, inicio + tope));
        inicio += tope - solape;
      }
      continue;
    }
    if (actual.length + parrafo.length + 2 > tope) {
      cerrar(actual);
      // El solape arrastra el final del fragmento anterior.
      actual = solape ? actual.slice(-solape) + "\n\n" + parrafo : parrafo;
    } else {
      actual = actual ? `${actual}\n\n${parrafo}` : parrafo;
    }
  }
  cerrar(actual);
  return fragmentos;
}
