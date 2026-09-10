```
npm install
npm start
```

# What is

The test mounts 20 rows, each wrapped in four view components, and dispatches ITERATIONS=2000 simulated `hover` events. Each event selects a row by updating the active-row state. Both implementations produce the same host structure and property changes, and the test verifies that host nodes remain stable during updates and are cleaned up on unmount.

## Hermes version

**Hermes 1.0.0, HBC 98**, built in **Release mode with the Hades garbage collector**:

- **Tag:** `hermes-v250829098.0.10`
- **Commit:** `becc964bd16002569bf74c4d8c190cfd2ad38985`

## Results

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
