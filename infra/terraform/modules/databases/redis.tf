resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.name_prefix}-redis-subnets"
  subnet_ids = var.private_subnet_ids
}

locals {
  redis_num_cache_clusters = var.redis_num_cache_clusters == null ? (local.prod_hardened ? 2 : 1) : var.redis_num_cache_clusters
  redis_failover_enabled   = var.redis_automatic_failover_enabled == null ? local.prod_hardened : var.redis_automatic_failover_enabled
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.name_prefix}-redis"
  description                = "Redis 7 for gateway rate limiting, idempotency, and token blacklist"
  engine                     = "redis"
  engine_version             = "7.0"
  node_type                  = var.redis_node_type
  num_cache_clusters         = local.redis_num_cache_clusters
  automatic_failover_enabled = local.redis_failover_enabled
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [var.security_group_id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.name_prefix}-redis"
  })
}
