export function writeLine(value) {
  print(value);
}

export function forceGC() {
  gc();
}

export function getStats() {
  const stats = HermesInternal.getInstrumentedStats();
  return {
    capacity: stats.js_heapSize,
    live: stats.js_allocatedBytes,
    totalAllocated: stats.js_totalAllocatedBytes,
    collections: stats.js_numGCs,
    gcMs: stats.js_gcTime * 1000,
  };
}

export function startMeasurement() {}

export function stopMeasurement(initial, after) {
  return {
    allocatedBytes: after.totalAllocated - initial.totalAllocated,
    allocationEstimated: false,
    collections: after.collections - initial.collections,
    gcMs: after.gcMs - initial.gcMs,
  };
}
