# The current ledger and fraud services use MONGODB_URI. The production path is
# Amazon DocumentDB compatibility; for lower-cost demos, deploy MongoDB inside
# EKS and pass that in through the same Kubernetes secret contract.
resource "aws_docdb_subnet_group" "events" {
  count      = var.enable_documentdb ? 1 : 0
  name       = "${var.name_prefix}-events-docdb-subnets"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.name_prefix}-events-docdb-subnets"
  })
}

resource "aws_docdb_cluster" "events" {
  count                     = var.enable_documentdb ? 1 : 0
  cluster_identifier        = "${var.name_prefix}-events-docdb"
  engine                    = "docdb"
  master_username           = var.documentdb_username
  master_password           = var.documentdb_password
  db_subnet_group_name      = aws_docdb_subnet_group.events[0].name
  vpc_security_group_ids    = [var.security_group_id]
  storage_encrypted         = true
  skip_final_snapshot       = !local.prod_hardened
  final_snapshot_identifier = local.prod_hardened ? "${var.name_prefix}-events-docdb-final" : null
  deletion_protection       = var.environment == "prod"
  backup_retention_period   = var.environment == "prod" ? 7 : 1

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.name_prefix}-events-docdb"
  })
}

resource "aws_docdb_cluster_instance" "events" {
  count              = var.enable_documentdb ? 1 : 0
  identifier         = "${var.name_prefix}-events-docdb-1"
  cluster_identifier = aws_docdb_cluster.events[0].id
  instance_class     = "db.t3.medium"

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${var.name_prefix}-events-docdb-1"
  })
}
