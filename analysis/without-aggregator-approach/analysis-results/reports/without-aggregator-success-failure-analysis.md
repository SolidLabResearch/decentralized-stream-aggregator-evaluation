# Without Aggregator Approach - Success/Failure Analysis

Generated on: 2025-09-09T13:16:55.947Z

This analysis reveals why latency appears low for higher client counts - many experiments failed to complete!

## Success Rate Analysis

| Clients | Total Runs | Successful | Failed | Success Rate | Avg Latency (successful only) | Median Latency | Min Latency | Max Latency | Std Dev |
|---------|------------|------------|--------|--------------|-------------------------------|----------------|-------------|-------------|----------|
| 1 clients | 35 | 35 | 0 | 100.0% | 94926ms | 87924ms | 62278ms | 145704ms | 23103ms |
| 2 clients | 35 | 35 | 0 | 100.0% | 104865ms | 87783ms | 62067ms | 223148ms | 44520ms |
| 3 clients | 35 | 35 | 0 | 100.0% | 136550ms | 84241ms | 63118ms | 283765ms | 82865ms |
| 4 clients | 35 | 35 | 0 | 100.0% | 196627ms | 169625ms | 67603ms | 345557ms | 107088ms |
| 5 clients | 35 | 35 | 0 | 100.0% | 245869ms | 287310ms | 67285ms | 417474ms | 129249ms |
| 6 clients | 35 | 35 | 0 | 100.0% | 422370ms | 448979ms | 79450ms | 503340ms | 94625ms |
| 7 clients | 35 | 35 | 0 | 100.0% | 451079ms | 516812ms | 82876ms | 593183ms | 151364ms |
| 8 clients | 35 | 31 | 4 | 88.6% | 573596ms | 607561ms | 51ms | 661806ms | 121647ms |
| 9 clients | 35 | 30 | 5 | 85.7% | 546144ms | 638287ms | 43ms | 719478ms | 215501ms |
| 10 clients | 35 | 14 | 21 | 40.0% | 520773ms | 640532ms | 69261ms | 708211ms | 234351ms |

## Key Insights

### Why 10 clients shows lower latency:
**Survivorship Bias**: Only 14/35 (40.0%) experiments completed successfully.
The failed experiments likely had infinite latency (never completed) or timed out.

### Performance Degradation Pattern:
- **1 clients**: 100.0% success rate - system stable
- **2 clients**: 100.0% success rate - system stable
- **3 clients**: 100.0% success rate - system stable
- **4 clients**: 100.0% success rate - system stable
- **5 clients**: 100.0% success rate - system stable
- **6 clients**: 100.0% success rate - system stable
- **7 clients**: 100.0% success rate - system stable
- **8 clients**: 88.6% success rate - system stable
- **9 clients**: 85.7% success rate - system stable
- **10 clients**: Only 40.0% success rate - system heavily overloaded

### True Performance Impact:
If we consider failed experiments as having infinite latency, the true performance would be much worse for higher client counts.
The reported averages only reflect the "lucky" runs that managed to complete.

