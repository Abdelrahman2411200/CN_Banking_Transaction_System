variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "name_prefix" {
  type    = string
  default = "cn-banking-dev"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "accounts_db_password" {
  type      = string
  sensitive = true
}

variable "transfers_db_password" {
  type      = string
  sensitive = true
}

variable "redis_auth_token" {
  type      = string
  sensitive = true
  default   = null
}

variable "enable_documentdb" {
  type    = bool
  default = false
}

variable "documentdb_password" {
  type      = string
  sensitive = true
  default   = null
}

variable "kafka_scram_username" {
  type    = string
  default = "cn_banking_app"
}

variable "kafka_scram_password" {
  type      = string
  sensitive = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
