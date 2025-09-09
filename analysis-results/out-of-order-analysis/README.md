# Out-of-Order Event Analysis

This directory contains a comprehensive analysis of out-of-order events in the decentralized stream aggregator system, examining performance across different client configurations (1-10 clients) with a 30-second allowable delay threshold.

## Directory Structure

```
out-of-order-analysis/
├── README.md                     # This file - overview and guide
├── csv-data/                     # Raw data and analysis results
│   ├── detailed-out-of-order-analysis.csv    # Per-iteration metrics with percentiles
│   └── summary-out-of-order-analysis.csv     # Aggregated statistics by client count
├── plots/                        # Generated visualizations
│   ├── out-of-order-summary.png             # Key metrics overview
│   ├── out-of-order-detailed.png            # Distribution analysis and heatmaps
│   └── performance-degradation.png          # Relative performance degradation
├── reports/                      # Analysis reports and documentation
│   └── Out-of-Order-Analysis-Report.md      # Comprehensive written analysis
└── scripts/                      # Analysis and visualization code
    ├── plot-out-of-order-analysis.py        # Visualization generation script
    └── out-of-order-analysis.js             # Main analysis script
```

## Key Findings Summary

- **Out-of-order event rate**: 1.0% → 6.7% (1 to 10 clients)
- **Average latency**: 1.4s → 24.2s (17x degradation)
- **Critical threshold violations**: 0% → 33.7% exceeding 30s delay
- **Recommended operational limit**: Maximum 5 clients

## Data Files

### CSV Data (`csv-data/`)

**`detailed-out-of-order-analysis.csv`**
- Complete per-iteration analysis across 350 experiments
- Columns include: Clients, Iteration, Total Events, Out-of-Order Events, Percentages, Latency statistics
- Percentile latencies (P50, P75, P90, P95, P99) for detailed distribution analysis

**`summary-out-of-order-analysis.csv`**
- Aggregated statistics by client count (1-10 clients)
- Total events, out-of-order counts, threshold violations, average latencies
- Ideal for quick overview and trend analysis

### Visualizations (`plots/`)

**`out-of-order-summary.png`**
- Four-panel summary showing key metrics by client count
- Out-of-order percentages, latency trends, threshold violations, absolute counts

**`out-of-order-detailed.png`**
- Advanced analysis with box plots, heatmaps, correlations
- Distribution analysis and latency percentile visualization

**`performance-degradation.png`**
- Normalized performance degradation relative to 1-client baseline
- Logarithmic scale showing exponential degradation patterns

## Analysis Methodology

### Data Source
- **Log Files**: CSPARQLWindow.log from 350 experimental iterations
- **Configurations**: 1-10 clients, 35 iterations each
- **Threshold**: 30,000ms (30 seconds) allowable out-of-order delay

### Metrics Calculated
- Event counts (total vs out-of-order)
- Out-of-order percentages
- Latency statistics (mean, min, max, std dev, percentiles)
- Threshold violation rates
- Performance degradation ratios

### Key Algorithms
- Timestamp-based latency calculation from log entries
- Statistical distribution analysis with percentile calculations
- Trend analysis and performance degradation modeling

## Running the Analysis

### Prerequisites
```bash
# Ensure Python environment is set up
source .venv/bin/activate
pip install pandas matplotlib seaborn numpy
```

### Generate New Analysis
```bash
# Run main analysis (JavaScript)
node scripts/out-of-order-analysis.js

# Generate visualizations (Python)
python scripts/plot-out-of-order-analysis.py
```

## Key Performance Insights

### Critical Thresholds Identified

| Client Range | Performance Level | Out-of-Order Rate | Threshold Violations | Recommendation |
|-------------|------------------|------------------|-------------------|----------------|
| 1-2 clients | Acceptable | ≤ 2.6% | ≤ 2.9% | Normal operation |
| 3-5 clients | Degraded | 3.2% - 4.7% | 11.1% - 17.7% | Monitor closely |
| 6+ clients | Critical | ≥ 5.6% | ≥ 24.2% | Avoid in production |

### System Behavior Patterns

1. **Linear Growth**: Out-of-order events increase consistently with client count
2. **Exponential Latency**: Average latency shows super-linear growth pattern
3. **Threshold Cascade**: Events exceeding 30s threshold grow exponentially after 5 clients

## Operational Recommendations

### Immediate Actions
- Set **operational limit at 5 clients maximum**
- Implement **circuit breaker** when out-of-order rate exceeds 5%
- Add **monitoring alerts** for events exceeding 20-second latency

### System Optimizations
- **Queue Management**: Priority queuing for time-sensitive events
- **Load Balancing**: Better distribution of processing load
- **Event Buffering**: Increased buffer sizes for burst traffic
- **Timeout Policies**: Graduated timeouts based on client load

### Architecture Considerations
- **Horizontal Scaling**: Event partitioning across aggregator instances
- **Event Ordering**: Logical timestamps or vector clocks
- **Backpressure**: Flow control mechanisms to prevent overload

## Usage Examples

### Quick Analysis Check
```bash
# View summary statistics
head csv-data/summary-out-of-order-analysis.csv

# Check worst-case scenarios
tail csv-data/detailed-out-of-order-analysis.csv
```

### Custom Analysis
```javascript
// Load and analyze specific client configuration
const analysis = require('./scripts/out-of-order-analysis.js');
const result = analysis.analyzeIteration(5, 10); // 5 clients, iteration 10
console.log(result);
```

---

**Analysis Date**: September 9, 2025  
**Data Period**: Complete experimental dataset (350 iterations)  
**Analysis Tool**: Custom JavaScript + Python visualization pipeline
