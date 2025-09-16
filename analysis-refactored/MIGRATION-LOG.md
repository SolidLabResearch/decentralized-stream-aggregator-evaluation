# Migration Log

## Migration Details
- **Date:** 2025-09-16T10:37:27.598Z
- **Source Directory:** /Users/kushbisen/Code/decentralized-stream-aggregator-evaluation
- **Target Directory:** /Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/analysis-refactored
- **Backup Directory:** /Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/backup-before-refactor

## Files Moved


### analysis-scripts/
- analyze-all-metrics-filtered.ts
- analyze-all-query-registrations.ts
- analyze-filtered-iterations.ts
- analyze-get-timing.ts
- analyze-query-registration-all-iterations.ts
- calculate-detailed-subscription.ts
- calculate-get-stats.ts
- calculate-query-registration.ts
- calculate-real-get-timing.ts
- calculate-subscription-timing.ts
- count-rsp-events.ts
- process-downloads-data.ts
- processAggregatorLog.ts
- test-log-analysis.ts



### analysis-outputs/
- test-aggregation.log
- test-output.csv
- with-aggregator-analysis.csv



### experimental-scripts/
- comunica-query.ts
- comunica-test.ts
- initialise-LDES.ts
- multiple-client-subscribe.ts
- rspql-parser.ts
- rspql-test.ts



### reports/
- analysis-results/performance-comparison-table-1client.md
- analysis-results/corrected-analysis-summary.md
- analysis-results/get-request-timing-correction.md
- analysis-results/sequential-pairing-results.md
- analysis-results/webhook-approaches-comparison.md
- analysis-results/with-aggregator-vs-without-aggregator-summary.md

**Subdirectories:**
- out-of-order-analysis/ (from analysis-results/out-of-order-analysis/*)
- with-aggregator-analysis/ (from analysis-results/with-aggregator-analysis/*)
- enhanced-analysis/ (from analysis-results/enhanced-with-aggregator-analysis/*)


### archive/
- analysis-results/archive/*



## Verification Steps

1. ✅ Backup created at `/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/backup-before-refactor`
2. ✅ New structure created at `/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/analysis-refactored`
3. ✅ Files copied to new locations
4. ✅ Documentation generated

## Next Steps

1. Verify the new structure works correctly
2. Update any import paths in scripts
3. Update CI/CD configurations if applicable
4. Remove old files after verification (optional)

## Rollback Instructions

If needed, you can rollback by:
1. Restoring files from `/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/backup-before-refactor`
2. Removing `/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/analysis-refactored`

## Modified Files

The following files may need path updates:
- Any scripts importing other analysis scripts
- Package.json scripts section
- README.md references
- CI/CD configuration files
