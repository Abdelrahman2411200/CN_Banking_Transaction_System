# Default production path: Amazon MSK manages Kafka brokers outside the app
# cluster. Cost-conscious dev environments can use self-hosted Kafka on EKS
# with the same KAFKA_BROKERS application config contract.
resource "aws_kms_key" "msk_scram" {
  description             = "KMS key for CN Banking MSK SCRAM credentials"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.name_prefix}-msk-scram-kms"
  })
}

resource "aws_kms_alias" "msk_scram" {
  name          = "alias/${var.name_prefix}-msk-scram"
  target_key_id = aws_kms_key.msk_scram.key_id
}

resource "aws_secretsmanager_secret" "msk_scram" {
  name                    = "AmazonMSK_${var.name_prefix}_scram"
  description             = "SCRAM credentials for ${var.name_prefix} MSK cluster"
  kms_key_id              = aws_kms_key.msk_scram.arn
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.name_prefix}-msk-scram"
  })
}

resource "aws_secretsmanager_secret_version" "msk_scram" {
  secret_id = aws_secretsmanager_secret.msk_scram.id
  secret_string = jsonencode({
    username = var.kafka_scram_username
    password = var.kafka_scram_password
  })
}

resource "aws_msk_cluster" "main" {
  cluster_name           = "${var.name_prefix}-kafka"
  kafka_version          = var.kafka_version
  number_of_broker_nodes = var.broker_count

  broker_node_group_info {
    instance_type   = var.broker_instance_type
    client_subnets  = var.private_subnet_ids
    security_groups = [var.security_group_id]

    storage_info {
      ebs_storage_info {
        volume_size = var.broker_volume_size
      }
    }
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  client_authentication {
    sasl {
      scram = true
    }
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk.name
      }
    }
  }

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.name_prefix}-kafka"
  })
}

resource "aws_cloudwatch_log_group" "msk" {
  name              = "/aws/msk/${var.name_prefix}-kafka"
  retention_in_days = var.msk_log_retention_days

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.name_prefix}-kafka-logs"
  })
}

resource "aws_msk_scram_secret_association" "main" {
  cluster_arn     = aws_msk_cluster.main.arn
  secret_arn_list = [aws_secretsmanager_secret.msk_scram.arn]

  depends_on = [aws_secretsmanager_secret_version.msk_scram]
}
