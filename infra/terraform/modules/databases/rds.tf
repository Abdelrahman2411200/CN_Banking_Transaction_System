locals {
  prod_hardened = var.environment == "prod"

  rds_skip_final_snapshot   = var.rds_skip_final_snapshot == null ? !local.prod_hardened : var.rds_skip_final_snapshot
  rds_deletion_protection   = var.rds_deletion_protection == null ? local.prod_hardened : var.rds_deletion_protection
  rds_backup_retention_days = var.rds_backup_retention_days == null ? (local.prod_hardened ? 7 : 1) : var.rds_backup_retention_days
  rds_apply_immediately     = var.rds_apply_immediately == null ? !local.prod_hardened : var.rds_apply_immediately
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-rds-subnets"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.name_prefix}-rds-subnets"
  })
}

resource "aws_db_instance" "accounts" {
  identifier                = "${var.name_prefix}-accounts-db"
  engine                    = "postgres"
  engine_version            = "15"
  instance_class            = var.db_instance_class
  allocated_storage         = var.db_allocated_storage
  db_name                   = var.accounts_db_name
  username                  = var.accounts_db_username
  password                  = var.accounts_db_password
  db_subnet_group_name      = aws_db_subnet_group.main.name
  vpc_security_group_ids    = [var.security_group_id]
  publicly_accessible       = false
  multi_az                  = var.multi_az
  skip_final_snapshot       = local.rds_skip_final_snapshot
  final_snapshot_identifier = local.rds_skip_final_snapshot ? null : "${var.name_prefix}-accounts-db-final"
  deletion_protection       = local.rds_deletion_protection
  backup_retention_period   = local.rds_backup_retention_days
  apply_immediately         = local.rds_apply_immediately
  storage_encrypted         = true

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.name_prefix}-accounts-db"
  })
}

resource "aws_db_instance" "transfers" {
  identifier                = "${var.name_prefix}-transfers-db"
  engine                    = "postgres"
  engine_version            = "15"
  instance_class            = var.db_instance_class
  allocated_storage         = var.db_allocated_storage
  db_name                   = var.transfers_db_name
  username                  = var.transfers_db_username
  password                  = var.transfers_db_password
  db_subnet_group_name      = aws_db_subnet_group.main.name
  vpc_security_group_ids    = [var.security_group_id]
  publicly_accessible       = false
  multi_az                  = var.multi_az
  skip_final_snapshot       = local.rds_skip_final_snapshot
  final_snapshot_identifier = local.rds_skip_final_snapshot ? null : "${var.name_prefix}-transfers-db-final"
  deletion_protection       = local.rds_deletion_protection
  backup_retention_period   = local.rds_backup_retention_days
  apply_immediately         = local.rds_apply_immediately
  storage_encrypted         = true

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.name_prefix}-transfers-db"
  })
}
