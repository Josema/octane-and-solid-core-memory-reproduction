```sh
npm run hermes
npm run node
```

Each framework runs in a fresh process. The Node.js child process uses `--expose-gc`,
`v8.getHeapStatistics()`, and `v8.GCProfiler` so the benchmark can force collections
and report V8 heap and GC metrics. Node.js versions that do not expose
`total_allocated_bytes` report cumulative allocation as an estimate derived from
the heap retained before and after every recorded collection; the results table
marks that metric as estimated.

# What is

The test mounts 20 rows, each wrapped in four view components, and dispatches ITERATIONS=2000 simulated `hover` events. Each event selects a row by updating the active-row state. Both implementations produce the same host structure and property changes, and the test verifies that host nodes remain stable during updates and are cleaned up on unmount.

## Hermes

**Hermes 1.0.0, HBC 98**, built in **Release mode with the Hades garbage collector**:

- **Tag:** `hermes-v250829098.0.10`
- **Commit:** `becc964bd16002569bf74c4d8c190cfd2ad38985`

| Metric                   | Octane 0.2.6 | Solid 2.0.0-rc.6 |
| ------------------------ | -----------: | ---------------: |
| Cumulative JS allocation |      3.88 GB |          5.82 MB |
| Sampled heap peak        |      112 MiB |            8 MiB |
| Heap capacity after GC   |      108 MiB |            8 MiB |
| Live JS after GC         |     54.10 MB |          0.37 MB |
| Live JS after unmount    |      0.22 MB |          0.23 MB |
| GC collections           |        1,364 |                6 |
| Time in GC               |      33.26 s |          0.18 ms |
| Elapsed time             |      36.37 s |         40.00 ms |

[Date: 9 sept 2026, 9:20:01]

---

| Metric                   | Octane 0.2.7 | Solid 2.0.0-rc.6 |
| ------------------------ | -----------: | ---------------: |
| Cumulative JS allocation |      2.35 GB |          5.82 MB |
| Sampled heap peak        |       88 MiB |            8 MiB |
| Heap capacity after GC   |       84 MiB |            8 MiB |
| Live JS after GC         |     53.45 MB |          0.37 MB |
| Live JS after unmount    |      0.22 MB |          0.23 MB |
| GC collections           |          629 |                6 |
| Time in GC               |       2.69 s |          0.15 ms |
| Elapsed time             |       4.59 s |         39.00 ms |

[Date: 10 sept 2026, 17:58:05]

## node.js

| Metric                               | Octane 0.2.6 | Solid 2.0.0-rc.6 |
| ------------------------------------ | -----------: | ---------------: |
| Cumulative JS allocation (estimated) |      3.01 GB |          4.87 MB |
| Sampled heap peak                    |   383.98 MiB |         7.84 MiB |
| Heap capacity after GC               |   336.23 MiB |         6.84 MiB |
| Live JS after GC                     |     40.39 MB |          4.47 MB |
| Live JS after unmount                |      4.72 MB |          4.33 MB |
| GC collections                       |           81 |                5 |
| Time in GC                           |    284.61 ms |          1.17 ms |
| Elapsed time                         |    838.00 ms |          9.00 ms |

[Date: 11 sept 2026, 07:28:53]

---

| Metric                               | Octane 0.2.7 | Solid 2.0.0-rc.6 |
| ------------------------------------ | -----------: | ---------------: |
| Cumulative JS allocation (estimated) |      1.94 GB |          4.88 MB |
| Sampled heap peak                    |   169.23 MiB |         7.84 MiB |
| Heap capacity after GC               |   169.73 MiB |         7.09 MiB |
| Live JS after GC                     |     40.76 MB |          4.47 MB |
| Live JS after unmount                |      5.53 MB |          4.33 MB |
| GC collections                       |           85 |                5 |
| Time in GC                           |     44.63 ms |          1.27 ms |
| Elapsed time                         |    370.00 ms |         10.00 ms |

[Date: 11 sept 2026, 07:28:29]
