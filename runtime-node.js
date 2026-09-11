import { GCProfiler, getHeapStatistics } from 'node:v8';

const nativeConsole = globalThis.console;
let profiler;

export function writeLine(value) {
  nativeConsole.log(value);
}

export function forceGC() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('Node.js must be started with --expose-gc');
  }
  globalThis.gc();
}

export function getStats() {
  const stats = getHeapStatistics();
  return {
    capacity: stats.total_heap_size,
    live: stats.used_heap_size,
    totalAllocated: stats.total_allocated_bytes ?? null,
  };
}

export function startMeasurement() {
  profiler = new GCProfiler();
  profiler.start();
}

export function stopMeasurement(initial, after) {
  const profile = profiler.stop();
  profiler = undefined;

  const reclaimedBytes = profile.statistics.reduce((total, collection) => {
    return total
      + collection.beforeGC.heapStatistics.usedHeapSize
      - collection.afterGC.heapStatistics.usedHeapSize;
  }, 0);
  const hasAllocationCounter = initial.totalAllocated !== null && after.totalAllocated !== null;

  return {
    allocatedBytes: hasAllocationCounter
      ? after.totalAllocated - initial.totalAllocated
      : Math.max(0, after.live - initial.live + reclaimedBytes),
    allocationEstimated: !hasAllocationCounter,
    collections: profile.statistics.length,
    // GCProfiler reports each collection cost in microseconds.
    gcMs: profile.statistics.reduce((total, collection) => total + collection.cost, 0) / 1000,
  };
}
