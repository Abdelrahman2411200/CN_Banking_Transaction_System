output "repository_urls" {
  value = { for name, repo in aws_ecr_repository.service : name => repo.repository_url }
}

output "api_gateway_repository_url" {
  value = aws_ecr_repository.service["api-gateway"].repository_url
}

output "account_service_repository_url" {
  value = aws_ecr_repository.service["account-service"].repository_url
}

output "transfer_service_repository_url" {
  value = aws_ecr_repository.service["transfer-service"].repository_url
}

output "ledger_service_repository_url" {
  value = aws_ecr_repository.service["ledger-service"].repository_url
}

output "fraud_service_repository_url" {
  value = aws_ecr_repository.service["fraud-service"].repository_url
}

output "notification_service_repository_url" {
  value = aws_ecr_repository.service["notification-service"].repository_url
}
