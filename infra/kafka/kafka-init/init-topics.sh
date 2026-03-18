#!/bin/bash

# Configuration for Confluent
BOOTSTRAP_SERVER=${KAFKA_BOOTSTRAP_SERVER:-kafka:29092}
RETENTION_7D=604800000
RETENTION_30D=2592000000

echo "Waiting for Kafka to be ready..."
until cub kafka-ready -b $BOOTSTRAP_SERVER 1 30; do
  echo "Kafka is unavailable - sleeping"
  sleep 1
done

echo "Kafka is up - creating topics"

# 1. bank.account.created (1 partition, 7d retention)
kafka-topics --create --if-not-exists --bootstrap-server $BOOTSTRAP_SERVER \
  --topic bank.account.created --partitions 1 --replication-factor 1 \
  --config retention.ms=$RETENTION_7D

# 2. bank.transfer.initiated (3 partitions, 7d retention)
kafka-topics --create --if-not-exists --bootstrap-server $BOOTSTRAP_SERVER \
  --topic bank.transfer.initiated --partitions 3 --replication-factor 1 \
  --config retention.ms=$RETENTION_7D

# 3. bank.transfer.completed (3 partitions, 30d retention)
kafka-topics --create --if-not-exists --bootstrap-server $BOOTSTRAP_SERVER \
  --topic bank.transfer.completed --partitions 3 --replication-factor 1 \
  --config retention.ms=$RETENTION_30D

# 4. bank.transfer.failed (1 partition, 7d retention)
kafka-topics --create --if-not-exists --bootstrap-server $BOOTSTRAP_SERVER \
  --topic bank.transfer.failed --partitions 1 --replication-factor 1 \
  --config retention.ms=$RETENTION_7D

# 5. bank.fraud.alert (1 partition, 30d retention)
kafka-topics --create --if-not-exists --bootstrap-server $BOOTSTRAP_SERVER \
  --topic bank.fraud.alert --partitions 1 --replication-factor 1 \
  --config retention.ms=$RETENTION_30D

echo "All topics created successfully."
