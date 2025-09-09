# Archive Directory

This directory contains older versions of analysis reports and data files that have been superseded by improved versions.

## Why These Files Are Archived

### Reports with NaN Processing Metrics (Fixed)
- `report-1-with-failures.md/csv` - Had NaN values for processing metrics
- `report-2-successful-only.md/csv` - Had NaN values for processing metrics

**Issue**: These reports were looking for processing metrics in `result-0-client.csv` instead of `without-aggregator-0-client.csv`

**Fixed In**: `../reports/complete-analysis-fixed.md` - Now has real processing metrics

### Earlier Analysis Attempts
- `without-aggregator-analysis-report.md` - Initial analysis without latency metrics
- `without-aggregator-analysis-with-latency-report.md` - Added latency but still had issues
- `without-aggregator-detailed-results.csv` - Earlier detailed data
- `without-aggregator-summary-results.csv` - Earlier summary data

**Superseded By**: The complete analysis in the main reports directory

## Current Recommended Files
Instead of these archived files, use:

### For Complete Analysis:
- `../reports/complete-analysis-fixed.md` 
- `../csv-data/complete-analysis-fixed.csv`

### For Survivorship Bias Analysis:
- `../reports/without-aggregator-success-failure-analysis.md`
- `../csv-data/without-aggregator-success-failure-analysis.csv`

## Historical Value
These files are kept for:
1. Reference to show the evolution of the analysis
2. Debugging if issues arise with current versions
3. Understanding the process of fixing the NaN metrics issue

Generated on: ${new Date().toISOString()}
