# Capa 1: serverless nativo en LA-Santiago (la-south-2), donde NO hay
# EventGrid pero sí FunctionGraph, SMN y OBS.
# Flujo: APIG/URL de la función recibe el caso → FunctionGraph lo procesa
# → OBS guarda el registro → SMN avisa por severidad.

terraform {
  required_providers {
    huaweicloud = {
      source  = "huaweicloud/huaweicloud"
      version = ">= 1.60.0"
    }
  }
}

variable "region" {
  default = "la-south-2"
}

provider "huaweicloud" {
  region = var.region
}

resource "huaweicloud_obs_bucket" "registros" {
  bucket = "kit-registros-${substr(uuid(), 0, 8)}"
  acl    = "private"

  lifecycle {
    ignore_changes = [bucket] # el uuid() es solo para evitar colisión de nombre global
  }
}

resource "huaweicloud_smn_topic" "avisos" {
  name         = "kit-avisos"
  display_name = "Avisos del kit"
}

resource "huaweicloud_smn_subscription" "correo" {
  topic_urn = huaweicloud_smn_topic.avisos.id
  endpoint  = var.correo_avisos
  protocol  = "email"
}

variable "correo_avisos" {
  description = "Correo que recibe los avisos de SMN"
  type        = string
}

resource "huaweicloud_fgs_function" "procesar" {
  name        = "kit-procesar-caso"
  app         = "default"
  agency      = "fgs-agency" # crear en IAM con permisos a OBS y SMN
  handler     = "index.handler"
  memory_size = 256
  timeout     = 60
  runtime     = "Node.js18.15"
  code_type   = "inline"
  # Esqueleto: el handler real (el nucleo/ compilado del kit) se sube
  # después como zip u OBS.
  func_code = base64encode(<<-JS
    exports.handler = async (event, context) => {
      // Aquí se conecta el nucleo/ del kit.
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, eco: event }),
      };
    };
  JS
  )
  environment = jsonencode([])
}

output "bucket_registros" {
  value = huaweicloud_obs_bucket.registros.bucket
}

output "topic_avisos" {
  value = huaweicloud_smn_topic.avisos.id
}
