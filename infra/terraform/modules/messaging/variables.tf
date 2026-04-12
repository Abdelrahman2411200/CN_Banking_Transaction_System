variable "name_prefix" {
  description = "Prefix used for messaging resources."
  type        = string
}

variable "environment" {
  description = "Environment name."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Kafka brokers."
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group that allows broker access only from EKS nodes."
  type        = string
}

variable "kafka_version" {
  type    = string
  default = "3.6.0"
}

variable "broker_instance_type" {
  type    = string
  default = "kafka.t3.small"
}

variable "broker_count" {
  type    = number
  default = 3
}

variable "broker_volume_size" {
  type    = number
  default = 20
}

variable "kafka_scram_username" {
  description = "MSK SASL/SCRAM username."
  type        = string
  default     = "cn_banking_app"
}

variable "kafka_scram_password" {
  description = "MSK SASL/SCRAM password."
  type        = string
  sensitive   = true
}

variable "msk_log_retention_days" {
  description = "CloudWatch retention period for MSK broker logs."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags for resources."
  type        = map(string)
  default     = {}
}
