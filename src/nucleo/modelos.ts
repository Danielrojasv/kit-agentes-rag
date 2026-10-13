/**
 * Proveedores de modelo de lenguaje con cadena de respaldo.
 *
 * Claude y Gemini por REST con fetch nativo. ModoReglas es el degradado
 * final: sin red y sin claves responde con reglas puras, para que la demo
 * nunca quede en negro. CadenaProveedores intenta en orden y deja registro
 * de qué proveedor respondió (eso se muestra en pantalla: honestidad
 * primero).
 */

export interface RespuestaModelo {
  texto: string;
  proveedor: string;
}

export interface Proveedor {
  readonly nombre: string;
  responder(sistema: string, mensaje: string): Promise<RespuestaModelo>;
}

async function postJson(
  url: string,
  cuerpo: unknown,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<any> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

export class ClaudeProveedor implements Proveedor {
  readonly nombre = "claude";
  static MODELO = "claude-haiku-5-5";

  constructor(
    private apiKey = process.env.ANTHROPIC_API_KEY ?? "",
    private modelo = ClaudeProveedor.MODELO,
    private timeoutMs = 60_000,
  ) {
    if (!this.apiKey) throw new Error("falta ANTHROPIC_API_KEY para ClaudeProveedor");
  }

  async responder(sistema: string, mensaje: string): Promise<RespuestaModelo> {
    const datos = await postJson(
      "https://api.anthropic.com/v1/messages",
      {
        model: this.modelo,
        max_tokens: 1024,
        system: sistema,
        messages: [{ role: "user", content: mensaje }],
      },
      { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      this.timeoutMs,
    );
    return { texto: datos.content[0].text, proveedor: this.nombre };
  }
}

export class GeminiProveedor implements Proveedor {
  readonly nombre = "gemini";
  static MODELO = "gemini-2.5-flash";

  constructor(
    private apiKey = process.env.GEMINI_API_KEY ?? "",
    private modelo = GeminiProveedor.MODELO,
    private timeoutMs = 60_000,
  ) {
    if (!this.apiKey) throw new Error("falta GEMINI_API_KEY para GeminiProveedor");
  }

  async responder(sistema: string, mensaje: string): Promise<RespuestaModelo> {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${this.modelo}:generateContent?key=${this.apiKey}`;
    const datos = await postJson(
      url,
      {
        system_instruction: { parts: [{ text: sistema }] },
        contents: [{ role: "user", parts: [{ text: mensaje }] }],
      },
      {},
      this.timeoutMs,
    );
    return { texto: datos.candidates[0].content.parts[0].text, proveedor: this.nombre };
  }
}

/**
 * Degradado final: responde con una función de reglas puras.
 *
 * La función de reglas la define cada dominio (por ejemplo: clasificar
 * por palabras clave y devolver la ficha correspondiente). Aquí solo se
 * garantiza que SIEMPRE hay respuesta.
 */
export class ModoReglas implements Proveedor {
  readonly nombre = "reglas";

  constructor(
    private reglas: (mensaje: string) => string = () =>
      "Modo degradado activo: sin modelo disponible. " +
      "La consulta quedó registrada para revisión humana.",
  ) {}

  async responder(_sistema: string, mensaje: string): Promise<RespuestaModelo> {
    return { texto: this.reglas(mensaje), proveedor: this.nombre };
  }
}

/**
 * Intenta cada proveedor en orden; el último debe ser infalible
 * (ModoReglas). Deja registro de los que fallaron.
 */
export class CadenaProveedores implements Proveedor {
  readonly nombre = "cadena";
  fallos: Array<[string, string]> = [];

  constructor(private proveedores: Proveedor[]) {
    if (proveedores.length === 0) throw new Error("la cadena necesita al menos un proveedor");
  }

  async responder(sistema: string, mensaje: string): Promise<RespuestaModelo> {
    let ultimoError: unknown;
    for (const proveedor of this.proveedores) {
      try {
        return await proveedor.responder(sistema, mensaje);
      } catch (e) {
        this.fallos.push([proveedor.nombre, String(e)]);
        ultimoError = e;
      }
    }
    throw new Error(`ningún proveedor respondió: ${String(ultimoError)}`);
  }
}
