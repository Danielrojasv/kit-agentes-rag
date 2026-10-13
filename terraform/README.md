# Terraform para Huawei Cloud

Dos perfiles, pensados como escalera de contingencia (de más integrado a
más portable). Hay cuentas que vienen con permisos acotados, por eso
ambos perfiles existen y el plan B es obligatorio.

## `santiago/` (capa 1, serverless nativo)

FunctionGraph + OBS + SMN en LA-Santiago (`la-south-2`). EventGrid NO está
en esta región (en Latinoamérica solo Sao Paulo), por eso el disparador es
la URL de la función o APIG, no un bus de eventos administrado.

```sh
cd santiago
terraform init
terraform apply -var correo_avisos=equipo@ejemplo.cl
```

Requiere una agencia IAM (`fgs-agency`) con permisos a OBS y SMN.

## `ecs/` (capa 2, plan B)

Una máquina con Docker que clona este repo y levanta el `docker-compose`
completo (Postgres+pgvector, Langfuse, app). Solo necesita permisos de
ECS, VPC y EIP.

```sh
cd ecs
terraform init
terraform apply -var repo_url=https://github.com/Danielrojasv/kit-agentes-rag -var postgres_password=$(openssl rand -hex 16)
```

## Estado de validación

Escrito contra la documentación del provider `huaweicloud/huaweicloud`
(>= 1.60). Pendiente correr `terraform validate` y un `apply` real en una
cuenta de prueba; los nombres de flavors e imágenes pueden variar según lo
que cada cuenta tenga habilitado. Si nada de esto levanta, la capa 3 es
correr el compose en cualquier máquina con Docker y un túnel.
