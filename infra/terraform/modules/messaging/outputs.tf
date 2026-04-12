output "kafka_bootstrap_brokers" {
  value = aws_msk_cluster.main.bootstrap_brokers
}

output "kafka_bootstrap_brokers_tls" {
  value = aws_msk_cluster.main.bootstrap_brokers_tls
}

output "kafka_bootstrap_brokers_sasl_scram" {
  value = aws_msk_cluster.main.bootstrap_brokers_sasl_scram
}

output "kafka_version" {
  value = aws_msk_cluster.main.kafka_version
}

output "kafka_security_group_id" {
  value = var.security_group_id
}

output "messaging_mode" {
  value = "msk"
}
