variable "name_prefix" {
  description = "Prefix used for EKS resources."
  type        = string
}

variable "environment" {
  description = "Environment name."
  type        = string
}

variable "cluster_name" {
  description = "EKS cluster name."
  type        = string
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version."
  type        = string
  default     = "1.29"
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the cluster and node group."
  type        = list(string)
}

variable "node_security_group_id" {
  description = "Security group with no direct public inbound node access."
  type        = string
}

variable "endpoint_public_access" {
  description = "Whether the EKS API endpoint is reachable from public networks."
  type        = bool
  default     = false
}

variable "endpoint_public_access_cidrs" {
  description = "CIDR allowlist for the public EKS API endpoint when enabled."
  type        = list(string)
  default     = []
}

variable "enabled_cluster_log_types" {
  description = "EKS control-plane log types to publish to CloudWatch."
  type        = list(string)
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

variable "cluster_log_retention_days" {
  description = "CloudWatch retention period for EKS control-plane logs."
  type        = number
  default     = 30
}

variable "node_instance_types" {
  description = "Managed node group instance types."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_desired_size" {
  type    = number
  default = 3
}

variable "node_max_size" {
  type    = number
  default = 6
}

variable "node_root_volume_size" {
  description = "EKS node root volume size in GiB."
  type        = number
  default     = 40
}

variable "tags" {
  description = "Additional tags for resources."
  type        = map(string)
  default     = {}
}
