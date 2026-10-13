# Plan B: una ECS en Huawei Cloud (región Santiago) con Docker,
# levantando el docker-compose del kit vía user_data.
# Es la capa 2 de la escalera; si los permisos de la cuenta no alcanzan
# para FunctionGraph/APIG, esto solo necesita ECS + VPC + EIP.

terraform {
  required_providers {
    huaweicloud = {
      source  = "huaweicloud/huaweicloud"
      version = ">= 1.60.0"
    }
  }
}

variable "region" {
  default = "la-south-2" # LA-Santiago
}

variable "repo_url" {
  description = "URL https del repo del kit a clonar en la instancia"
  type        = string
}

variable "postgres_password" {
  type      = string
  sensitive = true
}

provider "huaweicloud" {
  region = var.region
}

resource "huaweicloud_vpc" "kit" {
  name = "kit-vpc"
  cidr = "10.10.0.0/16"
}

resource "huaweicloud_vpc_subnet" "kit" {
  name       = "kit-subred"
  vpc_id     = huaweicloud_vpc.kit.id
  cidr       = "10.10.1.0/24"
  gateway_ip = "10.10.1.1"
}

resource "huaweicloud_networking_secgroup" "kit" {
  name = "kit-sg"
}

resource "huaweicloud_networking_secgroup_rule" "entrantes" {
  for_each          = toset(["22", "8000", "3000"])
  security_group_id = huaweicloud_networking_secgroup.kit.id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  ports             = each.value
  remote_ip_prefix  = "0.0.0.0/0"
}

data "huaweicloud_images_image" "ubuntu" {
  name        = "Ubuntu 22.04 server 64bit"
  most_recent = true
}

resource "huaweicloud_compute_instance" "kit" {
  name              = "kit-agentes-rag"
  image_id          = data.huaweicloud_images_image.ubuntu.id
  flavor_id         = "s6.large.2" # 2 vCPU / 4 GB; ajustar a lo que dé la cuenta
  security_group_ids = [huaweicloud_networking_secgroup.kit.id]

  network {
    uuid = huaweicloud_vpc_subnet.kit.id
  }

  user_data = <<-EOT
    #!/bin/bash
    set -e
    apt-get update
    apt-get install -y docker.io docker-compose-v2 git
    git clone ${var.repo_url} /srv/kit
    cd /srv/kit
    cp .env.example .env
    sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${var.postgres_password}/" .env
    sed -i "s/^NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$(openssl rand -hex 32)/" .env
    sed -i "s/^LANGFUSE_SALT=.*/LANGFUSE_SALT=$(openssl rand -hex 32)/" .env
    docker compose up -d
  EOT
}

resource "huaweicloud_vpc_eip" "kit" {
  publicip {
    type = "5_bgp"
  }
  bandwidth {
    name        = "kit-bw"
    size        = 5
    share_type  = "PER"
    charge_mode = "traffic"
  }
}

resource "huaweicloud_compute_eip_associate" "kit" {
  public_ip   = huaweicloud_vpc_eip.kit.address
  instance_id = huaweicloud_compute_instance.kit.id
}

output "ip_publica" {
  value = huaweicloud_vpc_eip.kit.address
}
