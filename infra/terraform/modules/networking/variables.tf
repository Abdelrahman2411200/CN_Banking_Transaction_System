variable "name_prefix" {
  description = "Prefix used for named AWS resources."
  type        = string
}

variable "environment" {
  description = "Environment name, for example dev or prod."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the banking VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Three public subnet CIDRs for ALB and NAT."
  type        = list(string)
  default     = ["10.0.0.0/20", "10.0.16.0/20", "10.0.32.0/20"]
}

variable "private_subnet_cidrs" {
  description = "Three private subnet CIDRs for EKS nodes and data services."
  type        = list(string)
  default     = ["10.0.64.0/20", "10.0.80.0/20", "10.0.96.0/20"]
}

variable "tags" {
  description = "Additional tags for resources."
  type        = map(string)
  default     = {}
}
