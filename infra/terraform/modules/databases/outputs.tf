output "accounts_db_endpoint" {
  value = aws_db_instance.accounts.address
}

output "accounts_db_name" {
  value = aws_db_instance.accounts.db_name
}

output "transfers_db_endpoint" {
  value = aws_db_instance.transfers.address
}

output "transfers_db_name" {
  value = aws_db_instance.transfers.db_name
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_port" {
  value = aws_elasticache_replication_group.redis.port
}

output "mongodb_compatible_endpoint" {
  value = var.enable_documentdb ? aws_docdb_cluster.events[0].endpoint : "self-hosted-mongodb-on-eks"
}
