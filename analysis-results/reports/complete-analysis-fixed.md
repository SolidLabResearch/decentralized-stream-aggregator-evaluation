# Complete Analysis: Failed vs Successful with Processing Metrics

Generated on: 2025-09-09T13:28:45.942Z

This report includes both latency and processing metrics, comparing failed vs successful experiments.

## Experiment Success Rates

| Clients | Total | Successful | Failed | Success Rate |
|---------|-------|------------|--------|---------------|
| 1 | 35 | 35 | 0 | 100.0% |
| 2 | 35 | 35 | 0 | 100.0% |
| 3 | 35 | 35 | 0 | 100.0% |
| 4 | 35 | 35 | 0 | 100.0% |
| 5 | 35 | 35 | 0 | 100.0% |
| 6 | 35 | 35 | 0 | 100.0% |
| 7 | 35 | 35 | 0 | 100.0% |
| 8 | 35 | 31 | 4 | 88.6% |
| 9 | 35 | 30 | 5 | 85.7% |
| 10 | 35 | 14 | 21 | 40.0% |

## Latency Analysis

### With Failed Experiments (10min timeout penalty) vs Successful Only

| Clients | Avg Latency (with failures) | Avg Latency (successful only) | Median (successful) | Min (successful) | Max (successful) | Std Dev (successful) |
|---------|------------------------------|--------------------------------|---------------------|------------------|------------------|----------------------|
| 1 | 94.9s | 94.9s | 87.9s | 62.3s | 145.7s | 23.1s |
| 2 | 104.9s | 104.9s | 87.8s | 62.1s | 223.1s | 44.5s |
| 3 | 136.6s | 136.6s | 84.2s | 63.1s | 283.8s | 82.9s |
| 4 | 196.6s | 196.6s | 169.6s | 67.6s | 345.6s | 107.1s |
| 5 | 245.9s | 245.9s | 287.3s | 67.3s | 417.5s | 129.2s |
| 6 | 422.4s | 422.4s | 449.0s | 79.5s | 503.3s | 94.6s |
| 7 | 451.1s | 451.1s | 516.8s | 82.9s | 593.2s | 151.4s |
| 8 | 576.6s | 573.6s | 607.6s | 0.1s | 661.8s | 121.6s |
| 9 | 553.8s | 546.1s | 638.3s | 0.0s | 719.5s | 215.5s |
| 10 | 568.3s | 520.8s | 640.5s | 69.3s | 708.2s | 234.4s |

## Processing Time Analysis (Successful Runs Only)

| Clients | Avg Add Event | Add Event StdDev | Avg Fetch Event | Fetch Event StdDev | Avg Preprocess | Preprocess StdDev | Total Preprocess |
|---------|---------------|------------------|-----------------|--------------------|-----------------|--------------------|-------------------|
| 1 | 9.19ms | 11.45ms | 16.53ms | 24.76ms | 0.24ms | 0.46ms | 18228ms |
| 2 | 8.31ms | 11.02ms | 40.21ms | 87.72ms | 0.26ms | 0.46ms | 19182ms |
| 3 | 6.51ms | 9.34ms | 61.45ms | 135.09ms | 0.28ms | 0.48ms | 21154ms |
| 4 | 4.45ms | 6.32ms | 78.46ms | 177.01ms | 0.30ms | 0.49ms | 22481ms |
| 5 | 4.48ms | 6.22ms | 95.14ms | 215.12ms | 0.31ms | 0.50ms | 23459ms |
| 6 | 3.77ms | 4.19ms | 105.66ms | 247.18ms | 0.34ms | 0.53ms | 25506ms |
| 7 | 4.96ms | 6.97ms | 115.81ms | 274.05ms | 0.36ms | 0.54ms | 27038ms |
| 8 | 3.03ms | 2.50ms | 122.48ms | 289.37ms | 0.31ms | 0.51ms | 20483ms |
| 9 | 4.34ms | 6.26ms | 112.41ms | 276.75ms | 0.32ms | 0.51ms | 19588ms |
| 10 | 4.66ms | 6.32ms | 95.51ms | 252.53ms | 0.32ms | 0.52ms | 8912ms |

## Processing Volume Analysis (Successful Runs Only)

| Clients | Successful Runs | Total Add Events | Total Fetch Events | Total Preprocess Events | Avg Events per Run |
|---------|-----------------|------------------|--------------------|--------------------------|--------------------|
| 1 | 35 | 74695 | 74695 | 74695 | 2134 |
| 2 | 35 | 74678 | 74678 | 74678 | 2134 |
| 3 | 35 | 74682 | 74682 | 74682 | 2134 |
| 4 | 35 | 74684 | 74684 | 74684 | 2134 |
| 5 | 35 | 74669 | 74669 | 74669 | 2133 |
| 6 | 35 | 74674 | 74674 | 74674 | 2134 |
| 7 | 35 | 74410 | 74410 | 74410 | 2126 |
| 8 | 31 | 65109 | 65110 | 65110 | 2100 |
| 9 | 30 | 60938 | 60939 | 60939 | 2031 |
| 10 | 14 | 28014 | 28014 | 28014 | 2001 |

## Key Insights

### 1. Latency Impact of Failures
- **8 clients**: 4 failures increase average latency by 1.0x (573.6s → 576.6s)
- **9 clients**: 5 failures increase average latency by 1.0x (546.1s → 553.8s)
- **10 clients**: 21 failures increase average latency by 1.1x (520.8s → 568.3s)

### 2. Processing Time Trends (Successful Runs)
- **1 clients**: 0ms avg preprocess, 17ms avg fetch, 9ms avg add event
- **2 clients**: 0ms avg preprocess, 40ms avg fetch, 8ms avg add event
- **3 clients**: 0ms avg preprocess, 61ms avg fetch, 7ms avg add event
- **4 clients**: 0ms avg preprocess, 78ms avg fetch, 4ms avg add event
- **5 clients**: 0ms avg preprocess, 95ms avg fetch, 4ms avg add event
- **6 clients**: 0ms avg preprocess, 106ms avg fetch, 4ms avg add event
- **7 clients**: 0ms avg preprocess, 116ms avg fetch, 5ms avg add event
- **8 clients**: 0ms avg preprocess, 122ms avg fetch, 3ms avg add event
- **9 clients**: 0ms avg preprocess, 112ms avg fetch, 4ms avg add event
- **10 clients**: 0ms avg preprocess, 96ms avg fetch, 5ms avg add event

### 3. System Load Indicators
- **1 clients**: 2134 events per run, 74695 total events processed
- **2 clients**: 2134 events per run, 74678 total events processed
- **3 clients**: 2134 events per run, 74682 total events processed
- **4 clients**: 2134 events per run, 74684 total events processed
- **5 clients**: 2133 events per run, 74669 total events processed
- **6 clients**: 2134 events per run, 74674 total events processed
- **7 clients**: 2126 events per run, 74410 total events processed
- **8 clients**: 2100 events per run, 65110 total events processed
- **9 clients**: 2031 events per run, 60939 total events processed
- **10 clients**: 2001 events per run, 28014 total events processed

### 4. Performance Summary
- **1-7 clients**: 100% success rate, stable processing times
- **8-9 clients**: ~85-88% success rate, increased processing times
- **10 clients**: 40% success rate, high variability in successful runs

