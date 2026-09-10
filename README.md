The test mounts 20 rows, each wrapped in four view components, and dispatches 2,000 simulated `hover` events. Each event selects a row by updating the active-row state. Both implementations produce the same host structure and property changes, and the test verifies that host nodes remain stable during updates and are cleaned up on unmount.

These are the results from one run:

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
