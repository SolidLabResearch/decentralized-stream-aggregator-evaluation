const fs = require('fs');
const path = require('path');

// Configuration
const BASE_LOCATION = '/Users/kushbisen/Downloads/WithoutAggregatorApproach';
const CLIENT_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ITERATIONS = Array.from({length: 35}, (_, i) => i + 1);
const ALLOWABLE_DELAY_MS = 30000; // 30 seconds

/**
 * Parse CSPARQLWindow.log file to extract out-of-order event information
 */
function parseCSPARQLWindowLog(logFilePath) {
    if (!fs.existsSync(logFilePath)) {
        return null;
    }
    
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    const outOfOrderEvents = [];
    const totalEvents = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Count all events
        if (line.includes('adding_event_to_the_window')) {
            totalEvents.push(line);
        }
        
        // Process out-of-order events
        if (line.includes('out_of_order_event_received')) {
            // Look for the next line which should contain Event Latency
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                const latencyMatch = nextLine.match(/Event Latency : (\d+)/);
                
                if (latencyMatch) {
                    const latencyMs = parseInt(latencyMatch[1]);
                    outOfOrderEvents.push({
                        latency: latencyMs,
                        withinDelay: latencyMs <= ALLOWABLE_DELAY_MS,
                        exceedsDelay: latencyMs > ALLOWABLE_DELAY_MS
                    });
                }
            }
        }
    }
    
    return {
        totalEvents: totalEvents.length,
        outOfOrderEvents: outOfOrderEvents,
        totalOutOfOrder: outOfOrderEvents.length,
        withinDelay: outOfOrderEvents.filter(e => e.withinDelay).length,
        exceedsDelay: outOfOrderEvents.filter(e => e.exceedsDelay).length
    };
}

/**
 * Calculate statistics for out-of-order events
 */
function calculateOutOfOrderStats(events) {
    if (!events || events.length === 0) {
        return {
            count: 0,
            meanLatency: 0,
            maxLatency: 0,
            minLatency: 0,
            stdDevLatency: 0,
            percentileLatencies: {},
            exceedsDelayCount: 0,
            exceedsDelayPercentage: 0
        };
    }
    
    const latencies = events.map(e => e.latency);
    const exceedsDelayEvents = events.filter(e => e.exceedsDelay);
    
    // Basic statistics
    const count = latencies.length;
    const sum = latencies.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const max = Math.max(...latencies);
    const min = Math.min(...latencies);
    
    // Standard deviation
    const variance = latencies.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    
    // Percentiles
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const percentiles = [50, 75, 90, 95, 99];
    const percentileLatencies = {};
    
    percentiles.forEach(p => {
        const index = Math.ceil((p / 100) * count) - 1;
        percentileLatencies[`p${p}`] = sortedLatencies[Math.max(0, index)];
    });
    
    return {
        count: count,
        meanLatency: mean,
        maxLatency: max,
        minLatency: min,
        stdDevLatency: stdDev,
        percentileLatencies: percentileLatencies,
        exceedsDelayCount: exceedsDelayEvents.length,
        exceedsDelayPercentage: (exceedsDelayEvents.length / count) * 100
    };
}

/**
 * Analyze a single iteration for out-of-order events
 */
function analyzeIteration(clientNum, iteration) {
    const iterationDir = path.join(BASE_LOCATION, `${clientNum}clients`, iteration.toString());
    const logFile = path.join(iterationDir, 'CSPARQLWindow.log');
    
    const logData = parseCSPARQLWindowLog(logFile);
    
    if (!logData) {
        return null;
    }
    
    const stats = calculateOutOfOrderStats(logData.outOfOrderEvents);
    
    return {
        clients: clientNum,
        iteration: iteration,
        totalEvents: logData.totalEvents,
        totalOutOfOrder: logData.totalOutOfOrder,
        outOfOrderPercentage: logData.totalEvents > 0 ? (logData.totalOutOfOrder / logData.totalEvents) * 100 : 0,
        withinDelayCount: logData.withinDelay,
        exceedsDelayCount: logData.exceedsDelay,
        exceedsDelayPercentage: logData.totalOutOfOrder > 0 ? (logData.exceedsDelay / logData.totalOutOfOrder) * 100 : 0,
        meanLatency: stats.meanLatency,
        maxLatency: stats.maxLatency,
        minLatency: stats.minLatency,
        stdDevLatency: stats.stdDevLatency,
        p50Latency: stats.percentileLatencies.p50 || 0,
        p75Latency: stats.percentileLatencies.p75 || 0,
        p90Latency: stats.percentileLatencies.p90 || 0,
        p95Latency: stats.percentileLatencies.p95 || 0,
        p99Latency: stats.percentileLatencies.p99 || 0
    };
}

/**
 * Analyze all client configurations and iterations
 */
function analyzeAllConfigurations() {
    const results = [];
    
    console.log('Analyzing out-of-order events...');
    
    for (const clientNum of CLIENT_COUNTS) {
        console.log(`Processing ${clientNum} clients...`);
        
        for (const iteration of ITERATIONS) {
            const analysis = analyzeIteration(clientNum, iteration);
            if (analysis) {
                results.push(analysis);
                if (iteration <= 3) { // Show details for first few iterations
                    console.log(`  Iteration ${iteration}: ${analysis.totalOutOfOrder}/${analysis.totalEvents} out-of-order (${analysis.outOfOrderPercentage.toFixed(1)}%), avg latency: ${analysis.meanLatency.toFixed(0)}ms`);
                }
            }
        }
    }
    
    return results;
}

/**
 * Generate detailed CSV output
 */
function generateDetailedCSV(results) {
    const headers = [
        'Clients', 'Iteration', 'Total_Events', 'Out_Of_Order_Events', 'Out_Of_Order_Percentage',
        'Within_Delay_Count', 'Exceeds_Delay_Count', 'Exceeds_Delay_Percentage',
        'Mean_Latency_ms', 'Min_Latency_ms', 'Max_Latency_ms', 'StdDev_Latency_ms',
        'P50_Latency_ms', 'P75_Latency_ms', 'P90_Latency_ms', 'P95_Latency_ms', 'P99_Latency_ms'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    for (const result of results) {
        const row = [
            result.clients, result.iteration, result.totalEvents, result.totalOutOfOrder,
            result.outOfOrderPercentage.toFixed(2), result.withinDelayCount, result.exceedsDelayCount,
            result.exceedsDelayPercentage.toFixed(2), result.meanLatency.toFixed(2),
            result.minLatency.toFixed(2), result.maxLatency.toFixed(2), result.stdDevLatency.toFixed(2),
            result.p50Latency.toFixed(2), result.p75Latency.toFixed(2), result.p90Latency.toFixed(2),
            result.p95Latency.toFixed(2), result.p99Latency.toFixed(2)
        ];
        
        csvContent += row.join(',') + '\n';
    }
    
    return csvContent;
}

/**
 * Generate summary statistics by client count
 */
function generateSummaryStats(results) {
    const summaryByClients = {};
    
    // Group by client count
    for (const result of results) {
        if (!summaryByClients[result.clients]) {
            summaryByClients[result.clients] = [];
        }
        summaryByClients[result.clients].push(result);
    }
    
    // Calculate summary statistics for each client count
    const summaryStats = [];
    
    for (const [clientCount, iterations] of Object.entries(summaryByClients)) {
        const totalEvents = iterations.reduce((sum, iter) => sum + iter.totalEvents, 0);
        const totalOutOfOrder = iterations.reduce((sum, iter) => sum + iter.totalOutOfOrder, 0);
        const totalExceedsDelay = iterations.reduce((sum, iter) => sum + iter.exceedsDelayCount, 0);
        
        // Average latencies
        const validLatencies = iterations.filter(iter => iter.totalOutOfOrder > 0);
        const avgMeanLatency = validLatencies.length > 0 ? 
            validLatencies.reduce((sum, iter) => sum + iter.meanLatency, 0) / validLatencies.length : 0;
        const avgMaxLatency = validLatencies.length > 0 ?
            validLatencies.reduce((sum, iter) => sum + iter.maxLatency, 0) / validLatencies.length : 0;
        
        summaryStats.push({
            clients: parseInt(clientCount),
            totalIterations: iterations.length,
            totalEvents: totalEvents,
            totalOutOfOrder: totalOutOfOrder,
            outOfOrderPercentage: totalEvents > 0 ? (totalOutOfOrder / totalEvents) * 100 : 0,
            exceedsDelayCount: totalExceedsDelay,
            exceedsDelayPercentage: totalOutOfOrder > 0 ? (totalExceedsDelay / totalOutOfOrder) * 100 : 0,
            avgMeanLatency: avgMeanLatency,
            avgMaxLatency: avgMaxLatency
        });
    }
    
    return summaryStats.sort((a, b) => a.clients - b.clients);
}

/**
 * Generate summary CSV
 */
function generateSummaryCSV(summaryStats) {
    const headers = [
        'Clients', 'Total_Iterations', 'Total_Events', 'Total_Out_Of_Order', 'Out_Of_Order_Percentage',
        'Exceeds_Delay_Count', 'Exceeds_Delay_Percentage', 'Avg_Mean_Latency_ms', 'Avg_Max_Latency_ms'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    for (const stat of summaryStats) {
        const row = [
            stat.clients, stat.totalIterations, stat.totalEvents, stat.totalOutOfOrder,
            stat.outOfOrderPercentage.toFixed(2), stat.exceedsDelayCount, stat.exceedsDelayPercentage.toFixed(2),
            stat.avgMeanLatency.toFixed(2), stat.avgMaxLatency.toFixed(2)
        ];
        
        csvContent += row.join(',') + '\n';
    }
    
    return csvContent;
}

/**
 * Print analysis report
 */
function printAnalysisReport(summaryStats) {
    console.log('\n' + '='.repeat(80));
    console.log('OUT-OF-ORDER EVENT ANALYSIS REPORT');
    console.log('='.repeat(80));
    console.log(`Allowable Out-of-Order Delay: ${ALLOWABLE_DELAY_MS}ms (${ALLOWABLE_DELAY_MS/1000}s)`);
    console.log('='.repeat(80));
    
    console.log('\nSUMMARY BY CLIENT COUNT:');
    console.log('-'.repeat(80));
    console.log('Clients | Events    | Out-of-Order | % OoO | Exceeds Delay | % Exceeds | Avg Latency');
    console.log('-'.repeat(80));
    
    for (const stat of summaryStats) {
        console.log(
            `${stat.clients.toString().padStart(7)} | ` +
            `${stat.totalEvents.toString().padStart(9)} | ` +
            `${stat.totalOutOfOrder.toString().padStart(12)} | ` +
            `${stat.outOfOrderPercentage.toFixed(1).padStart(5)}% | ` +
            `${stat.exceedsDelayCount.toString().padStart(13)} | ` +
            `${stat.exceedsDelayPercentage.toFixed(1).padStart(9)}% | ` +
            `${stat.avgMeanLatency.toFixed(0).padStart(7)}ms`
        );
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('KEY INSIGHTS:');
    console.log('='.repeat(80));
    
    // Calculate trends
    const firstClient = summaryStats[0];
    const lastClient = summaryStats[summaryStats.length - 1];
    
    const outOfOrderIncrease = lastClient.outOfOrderPercentage - firstClient.outOfOrderPercentage;
    const latencyIncrease = lastClient.avgMeanLatency - firstClient.avgMeanLatency;
    const exceedsDelayIncrease = lastClient.exceedsDelayPercentage - firstClient.exceedsDelayPercentage;
    
    console.log(`Out-of-order percentage increases by ${outOfOrderIncrease.toFixed(1)}% from 1 to ${lastClient.clients} clients`);
    console.log(`Average latency increases by ${latencyIncrease.toFixed(0)}ms from 1 to ${lastClient.clients} clients`);
    console.log(`Events exceeding delay threshold increase by ${exceedsDelayIncrease.toFixed(1)}% from 1 to ${lastClient.clients} clients`);
    
    // Find worst performing configuration
    const worstByLatency = summaryStats.reduce((worst, current) => 
        current.avgMeanLatency > worst.avgMeanLatency ? current : worst
    );
    const worstByExceeds = summaryStats.reduce((worst, current) => 
        current.exceedsDelayPercentage > worst.exceedsDelayPercentage ? current : worst
    );
    
    console.log(`Highest latency: ${worstByLatency.clients} clients (${worstByLatency.avgMeanLatency.toFixed(0)}ms avg)`);
    console.log(`Most delay violations: ${worstByExceeds.clients} clients (${worstByExceeds.exceedsDelayPercentage.toFixed(1)}% exceed ${ALLOWABLE_DELAY_MS}ms)`);
}

/**
 * Main function
 */
function main() {
    try {
        console.log('Starting out-of-order event analysis...');
        
        // Analyze all configurations
        const results = analyzeAllConfigurations();
        
        if (results.length === 0) {
            console.error('No valid data found!');
            return 1;
        }
        
        // Generate summary statistics
        const summaryStats = generateSummaryStats(results);
        
        // Create output directory
        const outputDir = path.join(__dirname, '../../analysis-results/out-of-order-analysis');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Save detailed CSV
        const detailedCSV = generateDetailedCSV(results);
        const detailedPath = path.join(outputDir, 'detailed-out-of-order-analysis.csv');
        fs.writeFileSync(detailedPath, detailedCSV);
        console.log(`Detailed analysis saved to: ${detailedPath}`);
        
        // Save summary CSV
        const summaryCSV = generateSummaryCSV(summaryStats);
        const summaryPath = path.join(outputDir, 'summary-out-of-order-analysis.csv');
        fs.writeFileSync(summaryPath, summaryCSV);
        console.log(`Summary analysis saved to: ${summaryPath}`);
        
        // Print analysis report
        printAnalysisReport(summaryStats);
        
        console.log(`\nAnalysis complete! Processed ${results.length} iterations across ${CLIENT_COUNTS.length} client configurations.`);
        return 0;
        
    } catch (error) {
        console.error('Error during analysis:', error);
        return 1;
    }
}

// Run the analysis
if (require.main === module) {
    process.exit(main());
}

module.exports = {
    analyzeIteration,
    analyzeAllConfigurations,
    calculateOutOfOrderStats,
    generateDetailedCSV,
    generateSummaryCSV
};
