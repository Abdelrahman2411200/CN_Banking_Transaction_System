variable "name_prefix" {
  description = "Prefix used for registry resources."
  type        = string
}

variable "services" {
  description = "Service names that need ECR repositories."
  type        = set(string)
  default = [
    "api-gateway",
    "account-service",
    "transfer-service",
    "ledger-service",
    "fraud-service",
    "notification-service"
  ]
}

variable "tags" {
  description = "Additional tags for resources."
  type        = map(string)
  default     = {}
}
