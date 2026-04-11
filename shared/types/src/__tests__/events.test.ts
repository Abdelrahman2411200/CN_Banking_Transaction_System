import {
  AccountCreatedEventSchema,
  EVENT_VERSION,
  KafkaTopics,
  TransferCompletedEventSchema,
  buildBaseEvent,
  createDeterministicUuid,
  createLedgerEntryId,
  parseEvent,
  serializeEvent,
} from '../events';

describe('Phase 2 event contracts', () => {
  it('buildBaseEvent produces a v1 event envelope', () => {
    const event = buildBaseEvent(KafkaTopics.accountCreated);

    expect(event.eventType).toBe(KafkaTopics.accountCreated);
    expect(event.version).toBe(EVENT_VERSION);
    expect(event.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
  });

  it('serializes and parses account-created events with the v1 schema', () => {
    const event = {
      ...buildBaseEvent(KafkaTopics.accountCreated),
      accountId: '123e4567-e89b-12d3-a456-426614174000',
      ownerName: 'Alice Example',
      email: 'alice@example.com',
      initialDeposit: '100.00',
    };

    const payload = serializeEvent(event);
    const parsed = parseEvent(payload, AccountCreatedEventSchema);

    expect(parsed).toEqual(event);
    expect(parsed.version).toBe(EVENT_VERSION);
  });

  it('parses completed transfer events with the expected contract shape', () => {
    const event = {
      ...buildBaseEvent(KafkaTopics.transferCompleted),
      transferId: '123e4567-e89b-12d3-a456-426614174001',
      fromAccountId: '123e4567-e89b-12d3-a456-426614174002',
      toAccountId: '123e4567-e89b-12d3-a456-426614174003',
      amount: '250.00',
      completedAt: new Date('2025-01-01T00:00:01.000Z').toISOString(),
    };

    const parsed = parseEvent(serializeEvent(event), TransferCompletedEventSchema);

    expect(parsed.transferId).toBe(event.transferId);
    expect(parsed.amount).toBe('250.00');
    expect(parsed.version).toBe(EVENT_VERSION);
  });

  it('creates deterministic UUIDs for repeated inputs', () => {
    const first = createDeterministicUuid('bank.transfer.completed:0:99:debit');
    const second = createDeterministicUuid('bank.transfer.completed:0:99:debit');
    const different = createDeterministicUuid('bank.transfer.completed:0:99:credit');

    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });

  it('creates stable but distinct ledger entry ids per entry type', () => {
    const debitId = createLedgerEntryId(KafkaTopics.transferCompleted, 2, '45', 'debit');
    const debitIdAgain = createLedgerEntryId(KafkaTopics.transferCompleted, 2, '45', 'debit');
    const creditId = createLedgerEntryId(KafkaTopics.transferCompleted, 2, '45', 'credit');

    expect(debitId).toBe(debitIdAgain);
    expect(debitId).not.toBe(creditId);
  });
});
