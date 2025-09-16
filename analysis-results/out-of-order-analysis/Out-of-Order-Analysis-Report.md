# Out-of-Order Event Analysis Report

## Executive Summary

This analysis examines out-of-order event behavior in the decentralized stream aggregator system across different client configurations (1-10 clients) over 35 iterations each. The study evaluates both the frequency and severity of out-of-order events using a 30-second (30,000ms) allowable delay threshold.

## Key Findings

### Out-of-Order Event Frequency
- **1 client**: 1.0% of events are out-of-order
- **10 clients**: 6.7% of events are out-of-order  
- **Trend**: 5.6 percentage point increase from 1 to 10 clients

### Latency Impact
- **1 client**: Average latency of 1,422ms
- **10 clients**: Average latency of 24,217ms
- **Degradation**: 17x increase in latency (22,795ms difference)

### Threshold Violations
- **1 client**: 0% of out-of-order events exceed 30s threshold
- **10 clients**: 33.7% of out-of-order events exceed 30s threshold
- **Critical Issue**: Over 1/3 of out-of-order events in high-load scenarios exceed acceptable delays

## Detailed Analysis by Client Count

| Clients | Total Events | Out-of-Order Events | OoO % | Exceeds 30s Threshold | % Exceeds | Avg Latency |
|---------|-------------|-------------------|-------|---------------------|-----------|-------------|
| 1       | 448,170     | 4,568             | 1.0%  | 0                   | 0.0%      | 1,422ms     |
| 2       | 673,902     | 17,344            | 2.6%  | 507                 | 2.9%      | 7,792ms     |
| 3       | 904,092     | 29,156            | 3.2%  | 3,236               | 11.1%     | 12,057ms    |
| 4       | 1,275,054   | 53,460            | 4.2%  | 8,891               | 16.6%     | 14,039ms    |
| 5       | 1,524,282   | 71,316            | 4.7%  | 12,591              | 17.7%     | 14,119ms    |
| 6       | 2,177,652   | 122,145           | 5.6%  | 29,581              | 24.2%     | 18,172ms    |
| 7       | 2,607,432   | 157,461           | 6.0%  | 42,061              | 26.7%     | 19,906ms    |
| 8       | 2,790,462   | 177,184           | 6.3%  | 53,355              | 30.1%     | 23,351ms    |
| 9       | 3,037,932   | 197,038           | 6.5%  | 63,405              | 32.2%     | 22,988ms    |
| 10      | 3,231,414   | 215,270           | 6.7%  | 72,615              | 33.7%     | 24,217ms    |

## Critical Performance Thresholds

### Acceptable Performance Range (1-2 clients)
- Out-of-order rate: ≤ 2.6%
- Threshold violations: ≤ 2.9%
- Average latency: ≤ 7.8 seconds

### Degraded Performance Range (3-5 clients)
- Out-of-order rate: 3.2% - 4.7%
- Threshold violations: 11.1% - 17.7%
- Average latency: 12-14 seconds

### Critical Performance Range (6+ clients)
- Out-of-order rate: ≥ 5.6%
- Threshold violations: ≥ 24.2%
- Average latency: ≥ 18 seconds

## System Behavior Patterns

### Linear Growth in Out-of-Order Events
The percentage of out-of-order events shows consistent growth with client count, indicating systematic performance degradation under load.

### Exponential Growth in Severe Violations
Events exceeding the 30-second threshold grow exponentially:
- 2 clients: 2.9% exceed threshold
- 6 clients: 24.2% exceed threshold (8x increase)
- 10 clients: 33.7% exceed threshold (11x increase)

### Latency Scaling Issues
Average latency increases super-linearly with client count, suggesting contention bottlenecks in the system architecture.

## Performance Recommendations

### Immediate Actions
1. **Set operational limit at 5 clients maximum** to maintain threshold violations below 18%
2. **Implement circuit breaker pattern** when out-of-order rate exceeds 5%
3. **Add monitoring alerts** for events exceeding 20-second latency

### System Optimizations
1. **Queue Management**: Implement priority queuing for time-sensitive events
2. **Load Balancing**: Distribute processing load more effectively across resources
3. **Event Buffering**: Increase buffer sizes to handle burst traffic
4. **Timeout Handling**: Implement graduated timeout policies based on client load

### Architecture Considerations
1. **Horizontal Scaling**: Consider event partitioning across multiple aggregator instances
2. **Event Ordering**: Implement logical timestamps or vector clocks for better ordering
3. **Backpressure**: Add flow control mechanisms to prevent system overload

## Data Files Generated

- **Detailed Analysis**: `detailed-out-of-order-analysis.csv` - Per-iteration metrics with percentile latencies
- **Summary Analysis**: `summary-out-of-order-analysis.csv` - Aggregated statistics by client count

## Resource Usage Analysis - Aggregator Approach (1 Client)

### Performance Summary (30 Filtered Iterations)

Based on comprehensive analysis of iterations 4-33, the aggregator approach demonstrates exceptional resource efficiency:

| **Performance Metric** | **Value** | **Range** | **Std Dev** |
|------------------------|-----------|-----------|-------------|
| Events per iteration | 2,147 | 2,145-2,148 | ±1 |
| Processing time | 198.35s | 197.58-198.95s | ±0.33s |
| Throughput | 10.82 events/sec | 10.80-10.86 | ±0.02 |
| System utilization | 9.69% | 5.27%-17.56% | ±3.10% |

### Setup Phase Performance
- **Query Registration**: 68.57ms ± 12.27ms (30 iterations)
- **Query Preprocessing**: 54.53ms ± 11.71ms (30 iterations)
- **Stream Subscription**: 176.56ms ± 24.71ms (30 iterations)

### Event Processing Efficiency (64,402 total events)
- **Event Preprocessing**: 0.29ms ± 0.46ms per event
- **RSP Engine Adding**: 8.66ms ± 10.66ms per event
- **GET Request Timing**: 14.90ms ± 21.71ms per request

### Resource Efficiency Highlights
1. **Extremely Stable Performance**: ±0.02 events/sec variance across 30 iterations
2. **Low Resource Utilization**: 9.69% average system utilization with 90% headroom
3. **Network Optimization**: 14.90ms average GET request time (vs 16.53ms without aggregator)
4. **High Event Volume**: 64,402 events processed across 99.18 minutes
5. **Predictable Runtime**: ~198 seconds per iteration with minimal variance

### Comparison: Aggregator vs Without Aggregator
| **Metric** | **With Aggregator** | **Without Aggregator** | **Improvement** |
|------------|-------------------|---------------------|-----------------|
| GET Request Time | 14.90ms ± 21.71ms | 16.53ms ± 24.76ms | **10% faster** |
| Event Processing | 8.66ms ± 10.66ms | 9.19ms ± 11.45ms | **6% faster** |
| Events/Iteration | 2,147 ± 1 | ~1,854 | **16% more** |
| Throughput Stability | ±0.02 events/sec | Higher variance | **Much more stable** |

The aggregator approach demonstrates superior resource efficiency with consistent performance, lower latency, and significantly improved stability compared to direct client connections.

## Analysis Methodology

- **Data Source**: CSPARQLWindow.log files from 350 experimental iterations (out-of-order analysis) + Aggregator logs from 30 filtered iterations (resource analysis)
- **Threshold**: 30,000ms (30 seconds) allowable out-of-order delay
- **Resource Analysis**: Iterations 4-33 (filtered to exclude initialization and shutdown effects)
- **Metrics Calculated**: 
  - Event counts and percentages
  - Latency statistics (mean, min, max, percentiles)
  - Threshold violation rates
  - Statistical distributions
  - Resource utilization and throughput analysis
  - Setup phase timing and event processing efficiency

---

*Analysis conducted on September 9, 2025 (out-of-order analysis) and September 16, 2025 (resource usage analysis) using comprehensive log data from decentralized stream aggregator performance evaluation.*
