variable "name_prefix" {
  description = "Prefix used for data resources."
  type        = string
}

variable "environment" {
  description = "Environment name."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for data services."
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group that allows inbound only from EKS nodes."
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB."
  type        = number
  default     = 20
}

variable "multi_az" {
  description = "Enable Multi-AZ for RDS."
  type        = bool
  default     = false
}

variable "rds_skip_final_snapshot" {
  description = "Override whether RDS skips the final snapshot. Defaults to false in prod and true elsewhere."
  type        = bool
  default     = null
}

variable "rds_deletion_protection" {
  description = "Override RDS deletion protection. Defaults to true in prod and false elsewhere."
  type        = bool
  default     = null
}

variable "rds_backup_retention_days" {
  description = "Override RDS backup retention days. Defaults to 7 in prod and 1 elsewhere."
  type        = number
  default     = null
}

variable "rds_apply_immediately" {
  description = "Override RDS apply_immediately. Defaults to false in prod and true elsewhere."
  type        = bool
  default     = null
}

variable "accounts_db_name" {
  type    = string
  default = "accounts_db"
}

variable "accounts_db_username" {
  type    = string
  default = "accounts_user"
}

variable "accounts_db_password" {
  type      = string
  sensitive = true
}

variable "transfers_db_name" {
  type    = string
  default = "transfers_db"
}

variable "transfers_db_username" {
  type    = string
  default = "transfers_user"
}

variable "transfers_db_password" {
  type      = string
  sensitive = true
}

variable "redis_node_type" {
  type    = string
  default = "cache.t3.micro"
}

variable "redis_auth_token" {
  type      = string
  sensitive = true
  default   = null
}

variable "redis_num_cache_clusters" {
  description = "Override Redis node count. Defaults to 2 in prod and 1 elsewhere."
  type        = number
  default     = null
}

variable "redis_automatic_failover_enabled" {
  description = "Override Redis automatic failover. Defaults to true in prod and false elsewhere."
  type        = bool
  default     = null
}

variable "enable_documentdb" {
  description = "Enable Amazon DocumentDB for MongoDB-compatible ledger/fraud persistence."
  type        = bool
  default     = false
}

variable "documentdb_username" {
  type    = string
  default = "banking_events_user"
}

variable "documentdb_password" {
  type      = string
  sensitive = true
  default   = null
}

variable "tags" {
  description = "Additional tags for resources."
  type        = map(string)
  default     = {}
}
