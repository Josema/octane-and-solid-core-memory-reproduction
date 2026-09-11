import { mount } from 'repro-framework';
import {
  forceGC,
  getStats,
  startMeasurement,
  stopMeasurement,
  writeLine,
} from 'repro-runtime';
import { createHost, ROW_COUNT, HOST_COUNT, EFFECT_COUNT } from './host.js';

globalThis.console = { log: writeLine, warn: writeLine, error: writeLine };
globalThis.queueMicrotask = callback => Promise.resolve().then(callback);

(async () => {
  const host = createHost();
  const root = mount(host);
  root.flush();
  await Promise.resolve();
  const rows = host.validate(-1);
  if (host.counts.effectCreates !== EFFECT_COUNT || host.counts.effectCleanups !== 0) throw new Error('Initial effects differ');
  host.startMeasurement();
  forceGC();
  startMeasurement();
  const initial = getStats();
  let peak_capacity = initial.capacity;
  const started = Date.now();
  const payload = Object.freeze({ type: 'hover' });
  for (let index = 0; index < ITERATIONS; index++) {
    root.dispatch(rows[index % ROW_COUNT], payload);
    root.flush();
    await Promise.resolve();
    if ((index + 1) % 100 === 0) {
      const sample = getStats();
      peak_capacity = Math.max(peak_capacity, sample.capacity);
      writeLine(JSON.stringify({
        checkpoint: index + 1,
        capacity: sample.capacity,
        allocated: sample.totalAllocated === null
          ? null
          : sample.totalAllocated - initial.totalAllocated,
      }));
    }
  }
  const before = getStats();
  forceGC();
  const after = getStats();
  host.validate((ITERATIONS - 1) % ROW_COUNT, rows);
  const expected_changes = 2 * ITERATIONS - 1;
  if (host.counts.creates !== HOST_COUNT || host.counts.destroys !== 0 || host.counts.eventCalls !== ITERATIONS || host.counts.activeChanges !== expected_changes || host.counts.nativeUpdates !== expected_changes || host.counts.styleChanges !== 0 || host.counts.effectCreates !== EFFECT_COUNT || host.counts.effectCleanups !== 0) throw new Error('Workload or effects changed: ' + JSON.stringify(host.counts));
  const elapsedMs = Date.now() - started;
  const measurement = stopMeasurement(initial, after);
  const result = {
    framework: FRAMEWORK, core: CORE_LABEL, iterations: ITERATIONS,
    elapsedMs, allocatedBytes: measurement.allocatedBytes,
    allocationEstimated: measurement.allocationEstimated,
    capacityMounted: initial.capacity, peakSampledCapacity: Math.max(peak_capacity, before.capacity),
    capacityBeforeGC: before.capacity, capacityAfterGC: after.capacity,
    liveAfterGC: after.live,
    collections: measurement.collections, gcMs: measurement.gcMs,
    hosts: host.nodes.size, counts: { ...host.counts },
  };
  root.unmount();
  await new Promise(resolve => setTimeout(resolve, 0));
  forceGC();
  if (host.nodes.size !== 0 || host.container.children.length !== 0 || host.counts.destroys !== HOST_COUNT || host.counts.effectCleanups !== EFFECT_COUNT) throw new Error('Incomplete teardown: ' + JSON.stringify(host.counts));
  result.afterUnmount = getStats().live;
  result.teardown = { hosts: host.nodes.size, destroyed: host.counts.destroys, effectCleanups: host.counts.effectCleanups };
  writeLine(JSON.stringify(result));
})().catch(error => { writeLine(JSON.stringify({ error: error.stack })); });
