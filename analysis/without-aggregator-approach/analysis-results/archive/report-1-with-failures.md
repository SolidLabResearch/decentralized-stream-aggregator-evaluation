# Report 1: Complete Analysis Including Failed Experiments

Generated on: 2025-09-09T13:21:54.073Z

This report includes ALL experiments. Failed experiments are assigned a 10 minute timeout penalty.

## Performance Impact Including Failures

| Clients | Total | Success | Failed | Success Rate | Avg Latency (with failures) | Median Latency | Std Dev | Avg Add Event | Avg Fetch Event | Avg Preprocess | Total Preprocess |
|---------|-------|---------|--------|--------------|------------------------------|----------------|---------|---------------|-----------------|----------------|------------------|
| 1 | 35 | 35 | 0 | 100.0% | 94.9s | 87.9s | 23.1s | NaNms | NaNms | NaNms | 0ms |
| 2 | 35 | 35 | 0 | 100.0% | 104.9s | 87.8s | 44.5s | NaNms | NaNms | NaNms | 0ms |
| 3 | 35 | 35 | 0 | 100.0% | 136.6s | 84.2s | 82.9s | NaNms | NaNms | NaNms | 0ms |
| 4 | 35 | 35 | 0 | 100.0% | 196.6s | 169.6s | 107.1s | NaNms | NaNms | NaNms | 0ms |
| 5 | 35 | 35 | 0 | 100.0% | 245.9s | 287.3s | 129.2s | NaNms | NaNms | NaNms | 0ms |
| 6 | 35 | 35 | 0 | 100.0% | 422.4s | 449.0s | 94.6s | NaNms | NaNms | NaNms | 0ms |
| 7 | 35 | 35 | 0 | 100.0% | 451.1s | 516.8s | 151.4s | NaNms | NaNms | NaNms | 0ms |
| 8 | 35 | 31 | 4 | 88.6% | 576.6s | 600.5s | 114.8s | NaNms | NaNms | NaNms | 0ms |
| 9 | 35 | 30 | 5 | 85.7% | 553.8s | 630.3s | 200.4s | NaNms | NaNms | NaNms | 0ms |
| 10 | 35 | 14 | 21 | 40.0% | 568.3s | 600.0s | 153.2s | NaNms | NaNms | NaNms | 0ms |

## Key Insights from Complete Analysis

### True Performance Degradation:
When including failed experiments (with 10-minute timeout penalty):

- **1 clients**: No failures, true performance = 94.9s
- **2 clients**: No failures, true performance = 104.9s
- **3 clients**: No failures, true performance = 136.6s
- **4 clients**: No failures, true performance = 196.6s
- **5 clients**: No failures, true performance = 245.9s
- **6 clients**: No failures, true performance = 422.4s
- **7 clients**: No failures, true performance = 451.1s
- **8 clients**: 4 failed experiments increase average latency by 1.0x
- **9 clients**: 5 failed experiments increase average latency by 1.0x
- **10 clients**: 21 failed experiments increase average latency by 1.1x

### System Overload Pattern:
The data shows clear system overload starting at 8 clients:
- 8 clients: 4/35 experiments failed (11.4%)
- 9 clients: 5/35 experiments failed (14.3%)
- 10 clients: 21/35 experiments failed (60.0%)

### Processing Time Analysis (Successful Runs Only):
Even in successful runs, processing times increase with client count:
- 1 clients: Avg preprocess time NaNms, Total: 0ms
- 2 clients: Avg preprocess time NaNms, Total: 0ms
- 3 clients: Avg preprocess time NaNms, Total: 0ms
- 4 clients: Avg preprocess time NaNms, Total: 0ms
- 5 clients: Avg preprocess time NaNms, Total: 0ms
- 6 clients: Avg preprocess time NaNms, Total: 0ms
- 7 clients: Avg preprocess time NaNms, Total: 0ms
- 8 clients: Avg preprocess time NaNms, Total: 0ms
- 9 clients: Avg preprocess time NaNms, Total: 0ms
- 10 clients: Avg preprocess time NaNms, Total: 0ms
