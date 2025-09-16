# Combined Analysis: Failed vs Successful Experiments

Generated on: 2025-09-09T13:24:59.753Z

This report compares metrics when including failed experiments vs. successful experiments only.

## Experiment Success Rates

| Clients | Total Experiments | Successful | Failed | Success Rate |
|---------|-------------------|------------|--------|---------------|
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

## Latency Comparison: Failed vs Successful Only

| Clients | Avg Latency (with 10min penalty) | Avg Latency (successful only) | Penalty Impact | Median (with penalty) | Median (successful only) |
|---------|-----------------------------------|--------------------------------|----------------|----------------------|-------------------------|
| 1 | 94.9s | 94.9s | 1.0x | 87.9s | 87.9s |
| 2 | 104.9s | 104.9s | 1.0x | 87.8s | 87.8s |
| 3 | 136.6s | 136.6s | 1.0x | 84.2s | 84.2s |
| 4 | 196.6s | 196.6s | 1.0x | 169.6s | 169.6s |
| 5 | 245.9s | 245.9s | 1.0x | 287.3s | 287.3s |
| 6 | 422.4s | 422.4s | 1.0x | 449.0s | 449.0s |
| 7 | 451.1s | 451.1s | 1.0x | 516.8s | 516.8s |
| 8 | 576.6s | 573.6s | 1.0x | 600.5s | 607.6s |
| 9 | 553.8s | 546.1s | 1.0x | 630.3s | 638.3s |
| 10 | 568.3s | 520.8s | 1.1x | 600.0s | 640.5s |

## Detailed Statistics for Successful Runs Only

| Clients | Count | Avg Latency | Median | Min | Max | Std Dev |
|---------|-------|-------------|--------|-----|-----|----------|
| 1 | 35 | 94.9s | 87.9s | 62.3s | 145.7s | 23.1s |
| 2 | 35 | 104.9s | 87.8s | 62.1s | 223.1s | 44.5s |
| 3 | 35 | 136.6s | 84.2s | 63.1s | 283.8s | 82.9s |
| 4 | 35 | 196.6s | 169.6s | 67.6s | 345.6s | 107.1s |
| 5 | 35 | 245.9s | 287.3s | 67.3s | 417.5s | 129.2s |
| 6 | 35 | 422.4s | 449.0s | 79.5s | 503.3s | 94.6s |
| 7 | 35 | 451.1s | 516.8s | 82.9s | 593.2s | 151.4s |
| 8 | 31 | 573.6s | 607.6s | 0.1s | 661.8s | 121.6s |
| 9 | 30 | 546.1s | 638.3s | 0.0s | 719.5s | 215.5s |
| 10 | 14 | 520.8s | 640.5s | 69.3s | 708.2s | 234.4s |

## Key Insights

### 1. Survivorship Bias Impact
- **8 clients**: 4 failures increase reported latency by 1.0x
- **9 clients**: 5 failures increase reported latency by 1.0x
- **10 clients**: 21 failures increase reported latency by 1.1x

### 2. System Performance Degradation (Successful Runs Only)
Even when considering only successful experiments, latency increases significantly:
- **1 clients**: 94.9s average (35/35 runs)
- **2 clients**: 104.9s average (35/35 runs)
- **3 clients**: 136.6s average (35/35 runs)
- **4 clients**: 196.6s average (35/35 runs)
- **5 clients**: 245.9s average (35/35 runs)
- **6 clients**: 422.4s average (35/35 runs)
- **7 clients**: 451.1s average (35/35 runs)
- **8 clients**: 573.6s average (31/35 runs)
- **9 clients**: 546.1s average (30/35 runs)
- **10 clients**: 520.8s average (14/35 runs)

### 3. Variability Analysis
Higher client counts show increased variability even in successful runs:
- **1 clients**: 24.3% coefficient of variation
- **2 clients**: 42.5% coefficient of variation
- **3 clients**: 60.7% coefficient of variation
- **4 clients**: 54.5% coefficient of variation
- **5 clients**: 52.6% coefficient of variation
- **6 clients**: 22.4% coefficient of variation
- **7 clients**: 33.6% coefficient of variation
- **8 clients**: 21.2% coefficient of variation
- **9 clients**: 39.5% coefficient of variation
- **10 clients**: 45.0% coefficient of variation

### 4. Critical Observations
- **1-7 clients**: 100% success rate, predictable performance
- **8-9 clients**: ~85-88% success rate, system under stress
- **10 clients**: 40% success rate, system heavily overloaded

The dramatic drop in success rate at 10 clients explains why the "average" latency appears deceptively low - most high-latency experiments failed completely and aren't included in the average.

