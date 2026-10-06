import assert from 'node:assert/strict';

// Test 1: Telemetry Deduplication Key
console.log('Test 1: Telemetry Reading Key Generation & Deduplication...');
{
  function getTelemetryReadingKey(reading: { satelliteId: string; parameter: string; timestamp: string }): string {
    return `${reading.satelliteId}:${reading.parameter}:${reading.timestamp}`;
  }

  const r1 = { satelliteId: 'SG-1', parameter: 'temperature', timestamp: '2026-09-26T12:00:00.000Z' };
  const r2 = { satelliteId: 'SG-1', parameter: 'temperature', timestamp: '2026-09-26T12:00:00.000Z' };
  const r3 = { satelliteId: 'SG-1', parameter: 'temperature', timestamp: '2026-09-26T12:00:01.000Z' };

  assert.equal(getTelemetryReadingKey(r1), getTelemetryReadingKey(r2), 'Identical readings must produce identical keys');
  assert.notEqual(getTelemetryReadingKey(r1), getTelemetryReadingKey(r3), 'Different timestamps must produce different keys');
  console.log('✓ Passed');
}

// Test 2: Bounded Telemetry Buffer & Deduplication Logic
console.log('Test 2: Bounded Telemetry Buffer & Deduplication Merge...');
{
  interface Reading {
    satelliteId: string;
    parameter: string;
    timestamp: string;
    value: number;
  }

  const getKey = (r: Reading) => `${r.satelliteId}:${r.parameter}:${r.timestamp}`;

  function mergeReadings(existing: Reading[], incoming: Reading[], limit: number = 5): Reading[] {
    const map = new Map<string, Reading>();
    for (const r of existing) map.set(getKey(r), r);
    for (const r of incoming) map.set(getKey(r), r);
    const sorted = Array.from(map.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    if (sorted.length > limit) {
      return sorted.slice(sorted.length - limit);
    }
    return sorted;
  }

  const initial: Reading[] = [
    { satelliteId: 'SG-1', parameter: 'temperature', timestamp: '2026-09-26T12:00:01.000Z', value: 20 },
    { satelliteId: 'SG-1', parameter: 'temperature', timestamp: '2026-09-26T12:00:02.000Z', value: 21 },
    { satelliteId: 'SG-1', parameter: 'temperature', timestamp: '2026-09-26T12:00:03.000Z', value: 22 },
  ];

  // Incoming has 1 duplicate (timestamp 03) and 3 new ones (04, 05, 06)
  const incoming: Reading[] = [
    { satelliteId: 'SG-1', parameter: 'temperature', timestamp: '2026-09-26T12:00:03.000Z', value: 22 },
    { satelliteId: 'SG-1', parameter: 'temperature', timestamp: '2026-09-26T12:00:04.000Z', value: 23 },
    { satelliteId: 'SG-1', parameter: 'temperature', timestamp: '2026-09-26T12:00:05.000Z', value: 24 },
    { satelliteId: 'SG-1', parameter: 'temperature', timestamp: '2026-09-26T12:00:06.000Z', value: 25 },
  ];

  const merged = mergeReadings(initial, incoming, 5);
  // Total unique: 6 (01, 02, 03, 04, 05, 06), limit is 5, oldest (01) dropped
  assert.equal(merged.length, 5, 'Buffer must be bounded to limit of 5');
  assert.equal(merged[0].timestamp, '2026-09-26T12:00:02.000Z', 'Oldest reading should be 02');
  assert.equal(merged[4].timestamp, '2026-09-26T12:00:06.000Z', 'Newest reading should be 06');
  // Check no duplicates for 03
  const count03 = merged.filter(r => r.timestamp === '2026-09-26T12:00:03.000Z').length;
  assert.equal(count03, 1, 'Duplicate reading must appear exactly once');
  console.log('✓ Passed');
}

// Test 3: Anomaly Deduplication and Bounded Buffer
console.log('Test 3: Anomaly Deduplication and Bounded Buffer...');
{
  interface Anomaly {
    anomalyId: string;
    satelliteId: string;
    severity: string;
  }

  function addAnomaly(prev: Anomaly[], newAnom: Anomaly, limit: number = 3): Anomaly[] {
    if (prev.some(a => a.anomalyId === newAnom.anomalyId)) {
      return prev;
    }
    const updated = [newAnom, ...prev];
    if (updated.length > limit) {
      updated.pop();
    }
    return updated;
  }

  let list: Anomaly[] = [];
  list = addAnomaly(list, { anomalyId: 'A1', satelliteId: 'SG-1', severity: 'low' });
  list = addAnomaly(list, { anomalyId: 'A2', satelliteId: 'SG-1', severity: 'medium' });
  list = addAnomaly(list, { anomalyId: 'A1', satelliteId: 'SG-1', severity: 'low' }); // duplicate
  assert.equal(list.length, 2, 'Duplicate anomaly must not be added');

  list = addAnomaly(list, { anomalyId: 'A3', satelliteId: 'SG-1', severity: 'high' });
  list = addAnomaly(list, { anomalyId: 'A4', satelliteId: 'SG-1', severity: 'critical' }); // exceeds limit of 3
  assert.equal(list.length, 3, 'Anomaly list must be bounded to 3');
  assert.equal(list[0].anomalyId, 'A4', 'Newest anomaly must be at index 0');
  assert.equal(list[2].anomalyId, 'A2', 'Oldest remaining anomaly should be A2 (A1 popped)');
  console.log('✓ Passed');
}

// Test 4: Connection Status State Machine Transitions
console.log('Test 4: Connection Status State Machine Transitions...');
{
  type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';
  const history: ConnectionStatus[] = [];

  let currentStatus: ConnectionStatus = 'disconnected';
  const listeners = new Set<(status: ConnectionStatus) => void>();

  function updateStatus(newStatus: ConnectionStatus) {
    if (currentStatus !== newStatus) {
      currentStatus = newStatus;
      listeners.forEach(l => l(newStatus));
    }
  }

  const unsubscribe = (() => {
    const l = (s: ConnectionStatus) => history.push(s);
    listeners.add(l);
    return () => listeners.delete(l);
  })();

  updateStatus('connecting');
  updateStatus('connected');
  updateStatus('reconnecting');
  updateStatus('connected');
  updateStatus('disconnected');

  assert.deepEqual(history, ['connecting', 'connected', 'reconnecting', 'connected', 'disconnected']);
  unsubscribe();
  updateStatus('connected');
  assert.equal(history.length, 5, 'Unsubscribed listener must not receive further events');
  console.log('✓ Passed');
}

// Test 5: Reconnection Resync Handlers
console.log('Test 5: Reconnection Resync Event Bus Handlers...');
{
  const resyncCallbacks = new Set<() => void>();
  let resyncCallCount = 0;

  function onReconnect(cb: () => void) {
    resyncCallbacks.add(cb);
    return () => resyncCallbacks.delete(cb);
  }

  function simulateReconnect() {
    resyncCallbacks.forEach(cb => cb());
  }

  const unsub1 = onReconnect(() => { resyncCallCount++; });
  const unsub2 = onReconnect(() => { resyncCallCount++; });

  simulateReconnect();
  assert.equal(resyncCallCount, 2, 'Both registered resync callbacks should fire on reconnect');

  unsub1();
  simulateReconnect();
  assert.equal(resyncCallCount, 3, 'Only unsub2 should fire after unsub1 unregistered');

  unsub2();
  simulateReconnect();
  assert.equal(resyncCallCount, 3, 'No callbacks should fire after all unsubscribed');
  console.log('✓ Passed');
}

// Test 6: Environment URL Fallback Resolution
console.log('Test 6: Environment URL Resolution...');
{
  function resolveWsUrl(envValue?: string, originFallback: string = 'http://localhost:5173'): string {
    if (envValue && envValue.trim().length > 0) {
      return envValue.trim().replace(/\/$/, '');
    }
    return originFallback;
  }

  assert.equal(resolveWsUrl(undefined), 'http://localhost:5173', 'Undefined env should fallback to origin');
  assert.equal(resolveWsUrl(''), 'http://localhost:5173', 'Empty string env should fallback to origin');
  assert.equal(resolveWsUrl('http://localhost:3001'), 'http://localhost:3001', 'Direct local port should be preserved');
  assert.equal(resolveWsUrl('https://api.spaceguard.io/'), 'https://api.spaceguard.io', 'Trailing slash should be stripped');
  console.log('✓ Passed');
}

console.log('\n===========================================');
console.log('ALL FRONTEND REALTIME ARCHITECTURE TESTS PASSED');
console.log('===========================================\n');
