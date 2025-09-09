# Analysis Results Organization

This directory contains all the analysis results for the decentralized stream aggregator evaluation.

## Directory Structure

### `/reports/` - Final Analysis Reports
Contains the main markdown reports with insights and analysis:

- **`complete-analysis-fixed.md`** - MAIN REPORT: Complete analysis with both latency and processing metrics
- **`combined-failed-vs-successful-analysis.md`** - Comparison of failed vs successful experiments  
- **`without-aggregator-success-failure-analysis.md`** - Success/failure rate analysis explaining survivorship bias

### `/csv-data/` - Data Files
Contains all CSV files with raw and processed data:

#### Primary Data Files:
- **`complete-analysis-fixed.csv`** - Complete metrics including processing times (MAIN DATA)
- **`combined-failed-vs-successful-analysis.csv`** - Failed vs successful comparison data
- **`without-aggregator-success-failure-analysis.csv`** - Success/failure rates

#### Detailed Data Files:
- **`without-aggregator-final-summary.csv`** - Summary with success rates
- **`without-aggregator-detailed-with-latency-results.csv`** - Detailed per-iteration data
- **`without-aggregator-summary-with-latency-results.csv`** - Summary with latency metrics

### `/archive/` - Older Analysis Versions
Contains earlier versions and intermediate analysis reports:

- Reports with NaN processing metrics (before fix)
- Initial analysis attempts
- Legacy reports

## Key Findings Summary

### Main Insights:
1. **Survivorship Bias**: 10 clients only completed 14/35 experiments (40% success rate)
2. **Performance Degradation**: Latency increases from 95s (1 client) to 521s (10 clients successful runs)
3. **Bottleneck Identification**: Event fetching is the main bottleneck (16ms → 95ms)
4. **System Reliability**: Performance cliff at 8+ clients

### Recommended Reading Order:
1. Start with `reports/complete-analysis-fixed.md` for comprehensive overview
2. Review `reports/without-aggregator-success-failure-analysis.md` for survivorship bias explanation
3. Use `csv-data/complete-analysis-fixed.csv` for detailed numerical analysis

## Generated On
${new Date().toISOString()}

## Scripts Used
All analysis scripts are located in `/src/log-processing/`:
- `complete-analysis-fixed.ts` - Main analysis script (generates primary reports)
- `success-failure-analysis.ts` - Survivorship bias analysis
- Other scripts in archive for historical reference
