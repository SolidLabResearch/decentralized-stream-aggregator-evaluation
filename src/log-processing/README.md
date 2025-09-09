# Log Processing Scripts

This directory contains scripts for processing and analyzing experimental data from the decentralized stream aggregator evaluation.

## Current Active Scripts

### Primary Analysis Scripts
- **`complete-analysis-fixed.ts`** - MAIN SCRIPT: Complete analysis with both latency and processing metrics
  - Generates `complete-analysis-fixed.md` and `complete-analysis-fixed.csv`
  - Reads from correct files (`without-aggregator-0-client.csv` for processing metrics)
  - Includes both failed experiment analysis and successful-only analysis

- **`success-failure-analysis.ts`** - Survivorship bias analysis
  - Generates success/failure rate analysis
  - Explains why 10-client latency appears deceptively low
  - Shows impact of failed experiments on averages

### Utility Scripts
- **`fast-summary-analysis.ts`** - Quick summary analysis
  - Faster execution for basic metrics
  - Good for quick checks

### Legacy Scripts (Still Functional)
- **`without-aggregator-batch-analysis.ts`** - Original batch analysis script
- **`generate-csv-report.ts`** - Basic CSV report generator

## Archive Directory
Contains older versions of scripts that have been superseded:
- Scripts that produced NaN processing metrics (before file path fix)
- Earlier attempts at combined analysis
- Intermediate development versions

## Usage

### To generate complete analysis:
```bash
npx ts-node src/log-processing/complete-analysis-fixed.ts
```

### To generate survivorship bias analysis:
```bash
npx ts-node src/log-processing/success-failure-analysis.ts
```

### To generate quick summary:
```bash
npx ts-node src/log-processing/fast-summary-analysis.ts
```

## Dependencies
- Requires access to `/Users/kushbisen/Downloads/WithoutAggregatorApproach/` data directory
- Uses utility functions from `../util/Util.ts`
- Outputs to project root directory (organized into `analysis-results/` by separate scripts)

## Data File Structure Expected
```
WithoutAggregatorApproach/
├── 1clients/1/
│   ├── without-aggregator-0-client.csv  # Processing metrics
│   ├── result-0-client.csv              # Query results  
│   ├── CSPARQLWindow.log                # Window events
│   └── ...
├── 2clients/1/
│   └── ...
...
```

Generated on: ${new Date().toISOString()}
