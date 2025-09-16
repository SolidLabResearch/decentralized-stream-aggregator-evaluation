# Refactored Analysis Structure

This directory contains the refactored analysis structure for the decentralized stream aggregator evaluation project.

## Directory Structure


### `analysis-scripts/`
All analysis TypeScript scripts

**Files:** 14 files



### `analysis-outputs/`
Generated analysis output files

**Files:** 3 files



### `experimental-scripts/`
Experimental and test scripts

**Files:** 6 files



### `reports/`
Final analysis reports and documentation

**Files:** 6 files
**Subdirectories:** out-of-order-analysis, with-aggregator-analysis, enhanced-analysis


### `archive/`
Archived analysis materials

**Files:** 1 files



## Usage

### Running Analysis Scripts
```bash
cd analysis-scripts
npx ts-node <script-name>.ts
```

### Viewing Reports
The `reports/` directory contains all final analysis results and documentation.

### Experimental Scripts
The `experimental-scripts/` directory contains test and experimental code.

## Migration Information

- **Created:** 2025-09-16T10:37:27.596Z
- **Source:** Original project root and analysis-results directory
- **Backup:** Available in `backup-before-refactor/` directory

## Key Analysis Scripts

1. **analyze-all-metrics-filtered.ts** - Comprehensive analysis using filtered iterations
2. **analyze-filtered-iterations.ts** - Query registration and subscription timing
3. **calculate-real-get-timing.ts** - GET request timing analysis
4. **process-downloads-data.ts** - Process experimental data from downloads

## Reports Summary

1. **performance-comparison-table-1client.md** - Main performance comparison table
2. **corrected-analysis-summary.md** - Corrected analysis methodology
3. **out-of-order-analysis/** - Out-of-order event analysis
4. **with-aggregator-analysis/** - Detailed aggregator performance analysis

For more details, see MIGRATION-LOG.md
