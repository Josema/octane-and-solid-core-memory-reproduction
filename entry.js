import { mount } from 'repro-framework';
import { createHost, ROW_COUNT, HOST_COUNT, EFFECT_COUNT } from './host.js';

globalThis.console = { log: print, warn: print, error: print };
globalThis.queueMicrotask = callback => Promise.resolve().then(callback);

(async () => {
  const host = createHost();
  const root = mount(host);
  root.flush();
  await Promise.resolve();
  const rows = host.validate(-1);
  if (host.counts.effectCreates !== EFFECT_COUNT || host.counts.effectCleanups !== 0) throw new Error('Initial effects differ');
  host.startMeasurement();
  gc();
  const initial = HermesInternal.getInstrumentedStats();
  let peak_capacity = initial.js_heapSize;
  const started = Date.now();
  const payload = Object.freeze({ type: 'hover' });
  for (let index = 0; index < ITERATIONS; index++) {
    root.dispatch(rows[index % ROW_COUNT], payload);
    root.flush();
    await Promise.resolve();
    if ((index + 1) % 100 === 0) {
      const sample = HermesInternal.getInstrumentedStats();
      peak_capacity = Math.max(peak_capacity, sample.js_heapSize);
      print(JSON.stringify({ checkpoint: index + 1, capacity: sample.js_heapSize, allocated: sample.js_totalAllocatedBytes - initial.js_totalAllocatedBytes }));
    }
  }
  const before = HermesInternal.getInstrumentedStats();
  gc();
  const after = HermesInternal.getInstrumentedStats();
  host.validate((ITERATIONS - 1) % ROW_COUNT, rows);
  const expected_changes = 2 * ITERATIONS - 1;
  if (host.counts.creates !== HOST_COUNT || host.counts.destroys !== 0 || host.counts.eventCalls !== ITERATIONS || host.counts.activeChanges !== expected_changes || host.counts.nativeUpdates !== expected_changes || host.counts.styleChanges !== 0 || host.counts.effectCreates !== EFFECT_COUNT || host.counts.effectCleanups !== 0) throw new Error('Workload or effects changed: ' + JSON.stringify(host.counts));
  const result = {
    framework: FRAMEWORK, core: CORE_LABEL, iterations: ITERATIONS,
    elapsedMs: Date.now() - started, allocatedBytes: after.js_totalAllocatedBytes - initial.js_totalAllocatedBytes,
    capacityMounted: initial.js_heapSize, peakSampledCapacity: Math.max(peak_capacity, before.js_heapSize),
    capacityBeforeGC: before.js_heapSize, capacityAfterGC: after.js_heapSize,
    liveAfterGC: after.js_allocatedBytes,
    collections: after.js_numGCs - initial.js_numGCs, gcMs: (after.js_gcTime - initial.js_gcTime) * 1000,
    hosts: host.nodes.size, counts: { ...host.counts },
  };
  root.unmount();
  await new Promise(resolve => setTimeout(resolve, 0));
  gc();
  if (host.nodes.size !== 0 || host.container.children.length !== 0 || host.counts.destroys !== HOST_COUNT || host.counts.effectCleanups !== EFFECT_COUNT) throw new Error('Incomplete teardown: ' + JSON.stringify(host.counts));
  result.afterUnmount = HermesInternal.getInstrumentedStats().js_allocatedBytes;
  result.teardown = { hosts: host.nodes.size, destroyed: host.counts.destroys, effectCleanups: host.counts.effectCleanups };
  print(JSON.stringify(result));
})().catch(error => { print(JSON.stringify({ error: error.stack })); });
