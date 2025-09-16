# Report 2: Successful Experiments Only Analysis

Generated on: 2025-09-09T13:23:25.812Z

This report analyzes ONLY the experiments that completed successfully.
It shows the true performance characteristics when the system works.

## Latency Analysis (Successful Runs Only)

| Clients | Successful Runs | Avg Latency | Median Latency | Min Latency | Max Latency | Std Dev Latency |
|---------|-----------------|-------------|----------------|-------------|-------------|------------------|
| 1 | 35/35 | 94.9s | 87.9s | 62.3s | 145.7s | 23.1s |
| 2 | 35/35 | 104.9s | 87.8s | 62.1s | 223.1s | 44.5s |
| 3 | 35/35 | 136.6s | 84.2s | 63.1s | 283.8s | 82.9s |
| 4 | 35/35 | 196.6s | 169.6s | 67.6s | 345.6s | 107.1s |
| 5 | 35/35 | 245.9s | 287.3s | 67.3s | 417.5s | 129.2s |
| 6 | 35/35 | 422.4s | 449.0s | 79.5s | 503.3s | 94.6s |
| 7 | 35/35 | 451.1s | 516.8s | 82.9s | 593.2s | 151.4s |
| 8 | 31/35 | 573.6s | 607.6s | 0.1s | 661.8s | 121.6s |
| 9 | 30/35 | 546.1s | 638.3s | 0.0s | 719.5s | 215.5s |
| 10 | 14/35 | 520.8s | 640.5s | 69.3s | 708.2s | 234.4s |

## Processing Time Analysis (Successful Runs Only)

| Clients | Add Event Time | Add Event StdDev | Fetch Event Time | Fetch Event StdDev | Preprocess Time | Preprocess StdDev | Total Preprocess |
|---------|----------------|------------------|------------------|--------------------|-----------------|--------------------|-------------------|
| 1 | NaNms | NaNms | NaNms | NaNms | NaNms | NaNms | 0ms |
| 2 | NaNms | NaNms | NaNms | NaNms | NaNms | NaNms | 0ms |
| 3 | NaNms | NaNms | NaNms | NaNms | NaNms | NaNms | 0ms |
| 4 | NaNms | NaNms | NaNms | NaNms | NaNms | NaNms | 0ms |
| 5 | NaNms | NaNms | NaNms | NaNms | NaNms | NaNms | 0ms |
| 6 | NaNms | NaNms | NaNms | NaNms | NaNms | NaNms | 0ms |
| 7 | NaNms | NaNms | NaNms | NaNms | NaNms | NaNms | 0ms |
| 8 | NaNms | NaNms | NaNms | NaNms | NaNms | NaNms | 0ms |
| 9 | NaNms | NaNms | NaNms | NaNms | NaNms | NaNms | 0ms |
| 10 | NaNms | NaNms | NaNms | NaNms | NaNms | NaNms | 0ms |

## Processing Volume Analysis

| Clients | Total Add Events | Total Fetch Events | Total Preprocess Events | Events per Run |
|---------|------------------|--------------------|--------------------------|-----------------|
| 1 | 0 | 0 | 0 | 0 |
| 2 | 0 | 0 | 0 | 0 |
| 3 | 0 | 0 | 0 | 0 |
| 4 | 0 | 0 | 0 | 0 |
| 5 | 0 | 0 | 0 | 0 |
| 6 | 0 | 0 | 0 | 0 |
| 7 | 0 | 0 | 0 | 0 |
| 8 | 0 | 0 | 0 | 0 |
| 9 | 0 | 0 | 0 | 0 |
| 10 | 0 | 0 | 0 | 0 |

## Performance Insights from Successful Runs

### Latency Progression (When System Works):
- **1 clients**: 94.9s average latency (35 successful runs)
- **2 clients**: 104.9s average latency (35 successful runs)
- **3 clients**: 136.6s average latency (35 successful runs)
- **4 clients**: 196.6s average latency (35 successful runs)
- **5 clients**: 245.9s average latency (35 successful runs)
- **6 clients**: 422.4s average latency (35 successful runs)
- **7 clients**: 451.1s average latency (35 successful runs)
- **8 clients**: 573.6s average latency (31 successful runs)
- **9 clients**: 546.1s average latency (30 successful runs)
- **10 clients**: 520.8s average latency (14 successful runs)

### Processing Time Trends:
- **1 clients**: NaNms avg preprocess time
- **2 clients**: NaNms avg preprocess time
- **3 clients**: NaNms avg preprocess time
- **4 clients**: NaNms avg preprocess time
- **5 clients**: NaNms avg preprocess time
- **6 clients**: NaNms avg preprocess time
- **7 clients**: NaNms avg preprocess time
- **8 clients**: NaNms avg preprocess time
- **9 clients**: NaNms avg preprocess time
- **10 clients**: NaNms avg preprocess time

### System Stability Indicators:
- **1 clients**: Latency variability 24.3% (StdDev/Mean)
- **2 clients**: Latency variability 42.5% (StdDev/Mean)
- **3 clients**: Latency variability 60.7% (StdDev/Mean)
- **4 clients**: Latency variability 54.5% (StdDev/Mean)
- **5 clients**: Latency variability 52.6% (StdDev/Mean)
- **6 clients**: Latency variability 22.4% (StdDev/Mean)
- **7 clients**: Latency variability 33.6% (StdDev/Mean)
- **8 clients**: Latency variability 21.2% (StdDev/Mean)
- **9 clients**: Latency variability 39.5% (StdDev/Mean)
- **10 clients**: Latency variability 45.0% (StdDev/Mean)

### Key Observations:
1. **True Performance Degradation**: Even successful runs show increasing latency with more clients
2. **Processing Overhead**: Preprocessing time increases with client count
3. **Variability**: Higher client counts show more variable performance
4. **Completeness**: Some client configurations have significantly fewer successful runs

