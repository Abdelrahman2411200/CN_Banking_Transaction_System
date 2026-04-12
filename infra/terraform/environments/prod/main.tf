terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

locals {
  common_tags = merge(var.tags, {
    Project     = "cn-banking"
    Environment = var.environment
  })
}

module "networking" {
  source      = "../../modules/networking"
  name_prefix = var.name_prefix
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
  tags        = local.common_tags
}

module "registry" {
  source      = "../../modules/registry"
  name_prefix = var.name_prefix
  tags        = local.common_tags
}

module "eks" {
  source                 = "../../modules/eks"
  name_prefix            = var.name_prefix
  environment            = var.environment
  cluster_name           = "${var.name_prefix}-eks"
  private_subnet_ids     = module.networking.private_subnet_ids
  node_security_group_id = module.networking.node_security_group_id
  tags                   = local.common_tags
}

module "databases" {
  source                = "../../modules/databases"
  name_prefix           = var.name_prefix
  environment           = var.environment
  private_subnet_ids    = module.networking.private_subnet_ids
  security_group_id     = module.networking.database_security_group_id
  accounts_db_password  = var.accounts_db_password
  transfers_db_password = var.transfers_db_password
  redis_auth_token      = var.redis_auth_token
  enable_documentdb     = var.enable_documentdb
  documentdb_password   = var.documentdb_password
  multi_az              = true
  tags                  = local.common_tags
}

module "messaging" {
  source                 = "../../modules/messaging"
  name_prefix            = var.name_prefix
  environment            = var.environment
  private_subnet_ids     = module.networking.private_subnet_ids
  security_group_id      = module.networking.database_security_group_id
  kafka_scram_username   = var.kafka_scram_username
  kafka_scram_password   = var.kafka_scram_password
  msk_log_retention_days = 30
  tags                   = local.common_tags
}
