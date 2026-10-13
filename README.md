# kit-agentes-rag

Template genérico para construir agentes de IA con RAG, en TypeScript con
NestJS. Trae la infraestructura que siempre se repite para partir un
proyecto de este tipo; la lógica de negocio, los documentos y los prompts
los pone cada proyecto encima.

**Qué trae.** Un bus de eventos portable, ingesta de documentos a
fragmentos con embeddings, almacén vectorial, proveedores de modelo con
cadena de respaldo y modo degradado, consulta RAG con citas obligatorias,
y un flujo de 4 pasos con estados y trazabilidad.

## Diseño

- **Núcleo sin dependencias.** `src/nucleo/` corre con Node 20+ pelado
  (fetch y crypto nativos). Las dependencias opcionales se importan tarde:
  `pdf-parse` para PDF, `pg` para pgvector. NestJS solo vive en `src/api/`.
- **Todo tiene un degradado.** Embeddings deterministas si no hay API,
  almacén en memoria si no hay Postgres, `ModoReglas` si no hay ningún
  modelo con red. El sistema nunca queda en negro y siempre dice qué
  proveedor respondió.
- **Humano al final.** El flujo termina en `ejecutable`,
  `requiere_revision` o `bloqueada`; nada se autoejecuta.
- **Trazabilidad.** Cada caso guarda su traza; el bus puede escribir un
  registro append-only; Langfuse (auto-hospedado en el compose) captura
  las trazas de los modelos.

## Uso rápido

```sh
pnpm install
pnpm test        # 29 pruebas del núcleo y el servicio
pnpm build && pnpm start   # API en :8000 (PORT para cambiarlo)

# stack completo: Postgres+pgvector, Langfuse y la API
cp .env.example .env   # completar claves
docker compose up -d
curl localhost:8000/salud
```

## Estructura

```
src/nucleo/   bus, fragmentos, embeddings, almacén, modelos, ingesta, rag, flujo
src/api/      NestJS (GET /salud, POST /ingestar, POST /consultar)
tests/        29 pruebas (vitest)
terraform/    Huawei Cloud: perfil serverless (Santiago) y plan B en ECS
datos/        vacío a propósito; aquí van los documentos de cada proyecto
```

## Escalera de despliegue

1. Serverless nativo (FunctionGraph Node.js + OBS + SMN, `terraform/santiago`).
2. ECS con Docker levantando este compose (`terraform/ecs`).
3. Cualquier máquina con Docker y un túnel.

La capa se elige según los permisos reales de la cuenta disponible.

## Licencia

MIT.
