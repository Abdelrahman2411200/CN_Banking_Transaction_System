# Phase 2 Plan: Event Backbone, Ledger, Fraud, and Notifications                                                                                                                                       
                                                                                                                                                                                                         
  ## Summary                                                                                                                                                                                             
                                                                                                                                                                                                         
  Build Phase 2 around Kafka + Zookeeper, three new service workspaces (ledger-service, fraud-service, notification-service), one MongoDB container, and a transactional outbox in the existing          
  Postgres-backed services.                                                                                                                                                                              
                                                                                                                                                                                                         
  Chosen defaults:                                                                                                                                                                                       
                                                                                                                                                                                                         
  - Kafka client: kafkajs                                                                                                                                                                                
  - MongoDB layout: one mongodb container, one logical database banking_events                                                                                                                           
  - Notification recipient strategy: notification-service looks up account emails from account-service by accountId                                                                                      
  - Freeze semantics: freezing an account blocks both debit and credit operations                                                                                                                        
  - Event delivery: transactional outbox in account-service and transfer-service, with in-process publisher workers                                                                                      
                                                                                                                                                                                                         
  ## Key Changes                                                                                                                                                                                         
                                                                                                                                                                                                         
  ### Infrastructure                                                                                                                                                                                     
                                                                                                                                                                                                         
  - Add zookeeper, kafka, kafka-init, mongodb, ledger-service (3003), fraud-service (3004), and notification-service (3005) to docker-compose.yml.                                                       
  - Add Kafka healthchecks based on successful broker/topic listing, and make all new services depend on Kafka readiness.                                                                                
  - Add a kafka-init container that creates exactly these topics on startup:                                                                                                                             
      - bank.account.created partition 3, retention 7d                                                                                                                                                   
      - bank.transfer.initiated partition 6, retention 7d                                                                                                                                                
      - bank.transfer.completed partition 6, retention 7d                                                                                                                                                
      - bank.transfer.failed partition 6, retention 7d                                                                                                                                                   
      - bank.fraud.alert partition 3, retention 30d                                                                                                                                                      
  - Extend .env.example, README, root scripts, and workspace config for Kafka, MongoDB, and the three new services.                                                                                      
                                                                                                                                                                                                         
  ### Shared contracts and internal libraries                                                                                                                                                            
                                                                                                                                                                                                         
  - Add shared/types/src/events.ts and re-export from shared/types/src/index.ts.                                                                                                                         
  - Define BaseEvent with { eventId, eventType, timestamp, version } and concrete AccountCreatedEvent, TransferInitiatedEvent, TransferCompletedEvent, TransferFailedEvent, FraudAlertEvent.             
  - Standardize version to "v1" for all Phase 2 events.                                                                                                                                                  
  - Add small shared helpers for:                                                                                                                                                                        
      - deterministic event serialization/deserialization                                                                                                                                                
      - Kafka topic names as constants                                                                                                                                                                   
      - deterministic UUID generation for ledger idempotency keys from topic + partition + offset + entryType                                                                                            
                                                                                                                                                                                                         
  ### Existing services                                                                                                                                                                                  
                                                                                                                                                                                                         
  - Account-service:                                                                                                                                                                                     
      - After successful account creation, write a bank.account.created outbox record in the same DB transaction.                                                                                        
      - Add POST /v1/accounts/:id/freeze returning the updated account with status = suspended.                                                                                                          
      - Update debit and credit endpoints to reject suspended accounts with 423 ACCOUNT_FROZEN.                                                                                                          
      - Start an in-process outbox publisher loop on service boot.                                                                                                                                       
  - Transfer-service:                                                                                                                                                                                    
      - Write bank.transfer.initiated outbox record immediately after transfer row creation.                                                                                                             
      - Write bank.transfer.completed when SAGA reaches committed completion.                                                                                                                            
      - Write bank.transfer.failed for every terminal failure path, including compensated failure and compensation failure, with reason sourced from the persisted transfer error.                       
      - Put outbox writes in the same DB transaction as the transfer state change that triggers them.                                                                                                    
      - Start an in-process outbox publisher loop on service boot.                                                                                                                                       
                                                                                                                                                                                                         
  ### Ledger-service                                                                                                                                                                                     
                                                                                                                                                                                                         
  - New Node/Express workspace on port 3003, with a Kafka consumer group dedicated to ledger processing.                                                                                                 
  - Consume bank.transfer.completed and bank.transfer.failed.                                                                                                                                            
  - Mongo collections:                                                                                                                                                                                   
      - ledger_entries for append-only ledger rows                                                                                                                                                       
      - internal consumer_offsets or equivalent idempotency metadata is not needed if idempotency is enforced by unique entryId                                                                          
  - For each bank.transfer.completed, insert exactly two rows:                                                                                                                                           
      - debit row for fromAccountId                                                                                                                                                                      
      - credit row for toAccountId                                                                                                                                                                       
  - For each bank.transfer.failed, write rows only when the failure represents a money movement that must be audited:                                                                                    
      - compensated failures produce two reversed rows mirroring the prior debit/credit reversal trail                                                                                                   
      - failures before debit produce no ledger rows                                                                                                                                                     
      - compensation failures still append the best-known reversal intent with status = failed so the inconsistency is visible                                                                           
  - Idempotency:                                                                                                                                                                                         
      - derive entryId as deterministic UUID v5 from Kafka topic/partition/offset plus entryType                                                                                                         
      - if insert hits duplicate key, skip silently and continue                                                                                                                                         
  - Public API:                                                                                                                                                                                          
      - GET /v1/ledger/:accountId?page&limit&from&to                                                                                                                                                     
      - GET /v1/ledger/transfer/:transferId                                                                                                                                                              
      - GET /v1/ledger/stats/:accountId                                                                                                                                                                  
  - Pagination defaults:                                                                                                                                                                                 
      - page=1, limit=20, max limit=100                                                                                                                                                                  
  - Stats response includes totalDebits, totalCredits, net, entryCount.                                                                                                                                  
                                                                                                                                                                                                         
  ### Fraud-service                                                                                                                                                                                      
                                                                                                                                                                                                         
  - New Node/Express workspace on port 3004, with a Kafka consumer for bank.transfer.initiated.                                                                                                          
  - Mongo collections:                                                                                                                                                                                   
      - fraud_events for persisted alerts                                                                                                                                                                
      - internal transfer_activity collection for rule windows (velocity_check, rapid_drain)                                                                                                             
  - On each transfer-initiated event:                                                                                                                                                                    
      - persist transfer activity first                                                                                                                                                                  
      - evaluate rules as named pure functions                                                                                                                                                           
      - for each triggered rule, persist one fraud alert document in fraud_events                                                                                                                        
      - publish one bank.fraud.alert event per triggered rule                                                                                                                                            
      - if severity is critical, call POST /v1/accounts/:id/freeze                                                                                                                                       
  - Rule definitions:                                                                                                                                                                                    
      - large_transfer: amount > 10000, severity high                                                                                                                                                    
      - velocity_check: count prior outgoing transfers from same account in last 60m; trigger when current event makes total > 5, severity medium                                                        
      - round_number: amount is an exact positive multiple of 1000, severity low                                                                                                                         
      - rapid_drain: sum of outgoing transfers from same account in last 10m including current event exceeds 80% of current account balance fetched from account-service, severity critical              
  - Public API:                                                                                                                                                                                          
      - GET /v1/fraud/alerts?severity&accountId&from&to&page&limit                                                                                                                                       
      - GET /v1/fraud/alerts/:alertId                                                                                                                                                                    
      - GET /v1/fraud/stats                                                                                                                                                                              
  - Stats scope:                                                                                                                                                                                         
      - totals by severity for today and thisWeek in one response.                                                                                                                                       
                                                                                                                                                                                                         
  ### Notification-service                                                                                                                                                                               
                                                                                                                                                                                                         
  - New Node/Express-less worker service on port 3005 only for health/readiness and lifecycle; business behavior is a Kafka consumer.                                                                    
  - Consume bank.transfer.completed, bank.transfer.failed, bank.fraud.alert.                                                                                                                             
  - No database.                                                                                                                                                                                         
  - Use mock adapters:                                                                                                                                                                                   
      - email adapter                                                                                                                                                                                    
      - sms adapter                                                                                                                                                                                      
      - push adapter kept present but unused in Phase 2                                                                                                                                                  
  - Delivery rules:                                                                                                                                                                                      
      - transfer.completed: fetch sender and receiver from account-service, send email to both                                                                                                           
      - transfer.failed: fetch sender only, send failure email                                                                                                                                           
      - fraud.alert: high/critical send SMS + email, low/medium send email only                                                                                                                          
  - Every notification attempt logs structured JSON with { notificationType, recipient, channel, status, timestamp }.                                                                                    
  - Phase 2 delivery behavior is fire-and-log only; no retry queue.                                                                                                                                      
                                                                                                                                                                                                         
  ## Important Interface Additions                                                                                                                                                                       
                                                                                                                                                                                                         
  - Account-service adds POST /v1/accounts/:id/freeze.                                                                                                                                                   
  - Shared event contracts add:                                                                                                                                                                          
      - AccountCreatedEvent                                                                                                                                                                              
      - TransferInitiatedEvent                                                                                                                                                                           
      - TransferCompletedEvent                                                                                                                                                                           
      - TransferFailedEvent                                                                                                                                                                              
      - FraudAlertEvent                                                                                                                                                                                  
  - New external endpoints:                                                                                                                                                                              
      - ledger read APIs on 3003                                                                                                                                                                         
      - fraud alert/stat APIs on 3004                                                                                                                                                                    
  - New internal service dependencies:                                                                                                                                                                   
      - transfer-service -> Kafka outbox publisher                                                                                                                                                       
      - ledger-service -> Kafka + Mongo                                                                                                                                                                  
      - fraud-service -> Kafka + Mongo + account-service                                                                                                                                                 
      - notification-service -> Kafka + account-service                                                                                                                                                  
                                                                                                                                                                                                         
  ## Test Plan                                                                                                                                                                                           
                                                                                                                                                                                                         
  - Shared types:                                                                                                                                                                                        
      - schema/typing tests for every event contract shape and version field                                                                                                                             
  - Account-service:                                                                                                                                                                                     
      - unit test for successful freeze                                                                                                                                                                  
      - unit test that debit/credit reject suspended accounts with 423                                                                                                                                   
      - unit test that account creation writes outbox row                                                                                                                                                
  - Transfer-service:                                                                                                                                                                                    
      - unit tests that initiated/completed/failed outbox rows are written at the correct state transitions                                                                                              
      - integration test: publish one TransferCompletedEvent, assert exactly two ledger entries with correct debit/credit types and Decimal128 amounts
      - API tests for account pagination, transfer lookup, and stats aggregation
  - Fraud-service:
      - unit tests for all four rules with edge cases around thresholds and time windows
      - integration test: publish TransferInitiatedEvent with 15000, assert one bank.fraud.alert is produced
      - integration test: critical rapid-drain path freezes the account
  - Notification-service:
      - unit test that completed transfer sends two emails
      - unit test that failed transfer sends sender email only
      - unit test that fraud severities map to correct channels
  - End-to-end:
      - docker compose up --build brings up all services plus Kafka/Mongo
      - completed transfer leads to ledger write and fraud evaluation within 2s
      - duplicate Kafka delivery does not duplicate ledger entries
      - large transfer appears in GET /v1/fraud/alerts

  ## Assumptions and defaults

  - Phase 1 remains the source of truth for account and transfer writes; Kafka is added as the downstream integration backbone, not the primary transaction mechanism.
  - Transactional outbox is implemented inside account-service and transfer-service, not as separate worker containers.
  - MongoDB uses one shared logical DB (banking_events) with separate collections per subsystem.
  - fraud_events stores alert documents; transfer_activity is added as an internal support collection so velocity and rapid-drain rules are correct across restarts.
  - entryId is deterministic UUID derived from Kafka partition/offset metadata because the prompt requires UUID while also requiring offset-based idempotency.
  - Freeze maps to account status suspended.
  - Notification-service resolves recipient emails by calling account-service because the event contracts are kept exactly as specified.
