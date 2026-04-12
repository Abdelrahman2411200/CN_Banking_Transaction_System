output "cluster_name" {
  value = module.eks.cluster_name
}

output "ecr_repository_urls" {
  value = module.registry.repository_urls
}

output "database_endpoints" {
  value = {
    accounts_db  = module.databases.accounts_db_endpoint
    transfers_db = module.databases.transfers_db_endpoint
    mongodb      = module.databases.mongodb_compatible_endpoint
  }
}

output "accounts_db_endpoint" {
  value = module.databases.accounts_db_endpoint
}

output "transfers_db_endpoint" {
  value = module.databases.transfers_db_endpoint
}

output "redis_endpoint" {
  value = module.databases.redis_endpoint
}

output "mongodb_compatible_endpoint" {
  value = module.databases.mongodb_compatible_endpoint
}

output "kafka_bootstrap_brokers" {
  value = module.messaging.kafka_bootstrap_brokers
}

output "kafka_bootstrap_brokers_tls" {
  value = module.messaging.kafka_bootstrap_brokers_tls
}

output "kafka_bootstrap_brokers_sasl_scram" {
  value = module.messaging.kafka_bootstrap_brokers_sasl_scram
}

output "kafka_version" {
  value = module.messaging.kafka_version
}
