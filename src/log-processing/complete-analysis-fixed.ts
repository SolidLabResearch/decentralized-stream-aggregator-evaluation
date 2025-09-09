import * as fs from 'fs';
import * as path from 'path';
import { calculate_mean, calculate_standard_deviation, calculate_sum } from '../util/Util';

const BASE_LOCATION = "/Users/kushbisen/Downloads/WithoutAggregatorApproach";

interface CompleteCombinedResult {
    client: number;
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    successRate: number;
    // Latency metrics
    avgLatencyWithFailures: number;
    avgLatencySuccessfulOnly: number;
    medianLatencySuccessfulOnly: number;
    minLatencySuccessfulOnly: number;
    maxLatencySuccessfulOnly: number;
    stdDevLatencySuccessfulOnly: number;
    // Processing metrics (successful runs only)
    avgAddEventTime: number;
    stdDevAddEventTime: number;
    avgFetchEventTime: number;
    stdDevFetchEventTime: number;
    avgPreprocessTime: number;
    stdDevPreprocessTime: number;
    totalPreprocessTime: number;
    // Volume metrics
    totalAddEventCalls: number;
    totalFetchEventCalls: number;
    totalPreprocessCalls: number;
    avgEventsPerRun: number;
}

function calculateFirstEventLatency(iterationDir: string): number {
    const csparlWindowLogPath = path.join(iterationDir, 'CSPARQLWindow.log');
    const resultCsvPath = path.join(iterationDir, 'result-0-client.csv');
    
    try {
        if (!fs.existsSync(resultCsvPath) || !fs.existsSync(csparlWindowLogPath)) {
            return -1;
        }
        
        const windowLog = fs.readFileSync(csparlWindowLogPath, 'utf-8');
        const windowLines = windowLog.split('\n');
        const firstEventLine = windowLines.find(line => line.includes('adding_event_to_the_window'));
        const firstEventTimestamp = firstEventLine?.split(',')[0];
        
        if (!firstEventTimestamp) return -1;
        
        const resultCsv = fs.readFileSync(resultCsvPath, 'utf-8');
        const resultLines = resultCsv.split('\n');
        const firstResultLine = resultLines.find(line => line.trim() && /^\d+,/.test(line));
        const firstResultTimestamp = firstResultLine?.split(',')[0];
        
        if (!firstResultTimestamp) return -1;
        
        const latency = parseInt(firstResultTimestamp) - parseInt(firstEventTimestamp);
        return Math.max(0, latency);
        
    } catch (error) {
        return -1;
    }
}

function processMetricsFile(filePath: string): {addEventTimes: number[], fetchEventTimes: number[], preprocessTimes: number[]} {
    const addEventTimes: number[] = [];
    const fetchEventTimes: number[] = [];
    const preprocessTimes: number[] = [];
    
    try {
        if (!fs.existsSync(filePath)) {
            return {addEventTimes, fetchEventTimes, preprocessTimes};
        }
        
        const file = fs.readFileSync(filePath, 'utf-8');
        const lines = file.split('\n');
        
        lines.forEach((line) => {
            const [key, value] = line.trim().split(',');
            if (!line || !value) return;
            
            if (key === 'time_to_fetch_notification') {
                fetchEventTimes.push(Number(value));
            } else if (key === 'time_to_add_event_to_rsp_engine') {
                addEventTimes.push(Number(value));
            } else if (key === 'time_to_preprocess_event') {
                preprocessTimes.push(Number(value));
            }
        });
    } catch (error) {
        console.log(`Error reading ${filePath}: ${error}`);
    }
    
    return {addEventTimes, fetchEventTimes, preprocessTimes};
}

function analyzeClientComplete(clientNum: number): CompleteCombinedResult {
    const clientDir = path.join(BASE_LOCATION, `${clientNum}clients`);
    
    const allAddEventTimes: number[] = [];
    const allFetchEventTimes: number[] = [];
    const allPreprocessTimes: number[] = [];
    const successfulLatencies: number[] = [];
    const allLatenciesWithPenalty: number[] = [];
    
    let successfulRuns = 0;
    const totalRuns = 35;
    const TIMEOUT_PENALTY = 10 * 60 * 1000; // 10 minutes
    
    console.log(`Analyzing ${clientNum} clients (complete analysis)...`);
    
    for (let i = 1; i <= totalRuns; i++) {
        const iterationDir = path.join(clientDir, i.toString());
        const metricsFile = path.join(iterationDir, `without-aggregator-0-client.csv`);
        const latency = calculateFirstEventLatency(iterationDir);
        
        if (latency >= 0) {
            // Successful run
            successfulRuns++;
            successfulLatencies.push(latency);
            allLatenciesWithPenalty.push(latency);
            
            // Process metrics from successful runs
            const metrics = processMetricsFile(metricsFile);
            allAddEventTimes.push(...metrics.addEventTimes);
            allFetchEventTimes.push(...metrics.fetchEventTimes);
            allPreprocessTimes.push(...metrics.preprocessTimes);
        } else {
            // Failed run
            allLatenciesWithPenalty.push(TIMEOUT_PENALTY);
        }
    }
    
    const failedRuns = totalRuns - successfulRuns;
    const sortedSuccessful = [...successfulLatencies].sort((a, b) => a - b);
    const medianSuccessful = sortedSuccessful.length > 0 ? 
        (sortedSuccessful.length % 2 === 0 ? 
            (sortedSuccessful[sortedSuccessful.length/2 - 1] + sortedSuccessful[sortedSuccessful.length/2]) / 2 :
            sortedSuccessful[Math.floor(sortedSuccessful.length/2)]) : 0;
    
    return {
        client: clientNum,
        totalRuns,
        successfulRuns,
        failedRuns,
        successRate: (successfulRuns / totalRuns) * 100,
        avgLatencyWithFailures: calculate_mean(allLatenciesWithPenalty),
        avgLatencySuccessfulOnly: calculate_mean(successfulLatencies),
        medianLatencySuccessfulOnly: medianSuccessful,
        minLatencySuccessfulOnly: successfulLatencies.length > 0 ? Math.min(...successfulLatencies) : 0,
        maxLatencySuccessfulOnly: successfulLatencies.length > 0 ? Math.max(...successfulLatencies) : 0,
        stdDevLatencySuccessfulOnly: calculate_standard_deviation(successfulLatencies),
        avgAddEventTime: calculate_mean(allAddEventTimes),
        stdDevAddEventTime: calculate_standard_deviation(allAddEventTimes),
        avgFetchEventTime: calculate_mean(allFetchEventTimes),
        stdDevFetchEventTime: calculate_standard_deviation(allFetchEventTimes),
        avgPreprocessTime: calculate_mean(allPreprocessTimes),
        stdDevPreprocessTime: calculate_standard_deviation(allPreprocessTimes),
        totalPreprocessTime: calculate_sum(allPreprocessTimes),
        totalAddEventCalls: allAddEventTimes.length,
        totalFetchEventCalls: allFetchEventTimes.length,
        totalPreprocessCalls: allPreprocessTimes.length,
        avgEventsPerRun: successfulRuns > 0 ? allPreprocessTimes.length / successfulRuns : 0
    };
}

function generateCompleteReport(analyses: CompleteCombinedResult[]): string {
    let markdown = `# Complete Analysis: Failed vs Successful with Processing Metrics\n\n`;
    markdown += `Generated on: ${new Date().toISOString()}\n\n`;
    markdown += `This report includes both latency and processing metrics, comparing failed vs successful experiments.\n\n`;

    // Success Rate Table
    markdown += `## Experiment Success Rates\n\n`;
    markdown += `| Clients | Total | Successful | Failed | Success Rate |\n`;
    markdown += `|---------|-------|------------|--------|---------------|\n`;
    
    analyses.forEach(analysis => {
        markdown += `| ${analysis.client} | ${analysis.totalRuns} | ${analysis.successfulRuns} | ${analysis.failedRuns} | ${analysis.successRate.toFixed(1)}% |\n`;
    });

    // Latency Comparison
    markdown += `\n## Latency Analysis\n\n`;
    markdown += `### With Failed Experiments (10min timeout penalty) vs Successful Only\n\n`;
    markdown += `| Clients | Avg Latency (with failures) | Avg Latency (successful only) | Median (successful) | Min (successful) | Max (successful) | Std Dev (successful) |\n`;
    markdown += `|---------|------------------------------|--------------------------------|---------------------|------------------|------------------|----------------------|\n`;
    
    analyses.forEach(analysis => {
        markdown += `| ${analysis.client} | ${(analysis.avgLatencyWithFailures/1000).toFixed(1)}s | ${(analysis.avgLatencySuccessfulOnly/1000).toFixed(1)}s | ${(analysis.medianLatencySuccessfulOnly/1000).toFixed(1)}s | ${(analysis.minLatencySuccessfulOnly/1000).toFixed(1)}s | ${(analysis.maxLatencySuccessfulOnly/1000).toFixed(1)}s | ${(analysis.stdDevLatencySuccessfulOnly/1000).toFixed(1)}s |\n`;
    });

    // Processing Metrics
    markdown += `\n## Processing Time Analysis (Successful Runs Only)\n\n`;
    markdown += `| Clients | Avg Add Event | Add Event StdDev | Avg Fetch Event | Fetch Event StdDev | Avg Preprocess | Preprocess StdDev | Total Preprocess |\n`;
    markdown += `|---------|---------------|------------------|-----------------|--------------------|-----------------|--------------------|-------------------|\n`;
    
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            markdown += `| ${analysis.client} | ${analysis.avgAddEventTime.toFixed(2)}ms | ${analysis.stdDevAddEventTime.toFixed(2)}ms | ${analysis.avgFetchEventTime.toFixed(2)}ms | ${analysis.stdDevFetchEventTime.toFixed(2)}ms | ${analysis.avgPreprocessTime.toFixed(2)}ms | ${analysis.stdDevPreprocessTime.toFixed(2)}ms | ${analysis.totalPreprocessTime.toFixed(0)}ms |\n`;
        }
    });

    // Volume Analysis
    markdown += `\n## Processing Volume Analysis (Successful Runs Only)\n\n`;
    markdown += `| Clients | Successful Runs | Total Add Events | Total Fetch Events | Total Preprocess Events | Avg Events per Run |\n`;
    markdown += `|---------|-----------------|------------------|--------------------|--------------------------|--------------------|`;
    
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            markdown += `\n| ${analysis.client} | ${analysis.successfulRuns} | ${analysis.totalAddEventCalls} | ${analysis.totalFetchEventCalls} | ${analysis.totalPreprocessCalls} | ${analysis.avgEventsPerRun.toFixed(0)} |`;
        }
    });

    markdown += `\n\n## Key Insights\n\n`;

    markdown += `### 1. Latency Impact of Failures\n`;
    analyses.forEach(analysis => {
        if (analysis.failedRuns > 0) {
            const impact = analysis.avgLatencyWithFailures / analysis.avgLatencySuccessfulOnly;
            markdown += `- **${analysis.client} clients**: ${analysis.failedRuns} failures increase average latency by ${impact.toFixed(1)}x (${(analysis.avgLatencySuccessfulOnly/1000).toFixed(1)}s → ${(analysis.avgLatencyWithFailures/1000).toFixed(1)}s)\n`;
        }
    });

    markdown += `\n### 2. Processing Time Trends (Successful Runs)\n`;
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            markdown += `- **${analysis.client} clients**: ${analysis.avgPreprocessTime.toFixed(0)}ms avg preprocess, ${analysis.avgFetchEventTime.toFixed(0)}ms avg fetch, ${analysis.avgAddEventTime.toFixed(0)}ms avg add event\n`;
        }
    });

    markdown += `\n### 3. System Load Indicators\n`;
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            markdown += `- **${analysis.client} clients**: ${analysis.avgEventsPerRun.toFixed(0)} events per run, ${analysis.totalPreprocessCalls} total events processed\n`;
        }
    });

    markdown += `\n### 4. Performance Summary\n`;
    markdown += `- **1-7 clients**: 100% success rate, stable processing times\n`;
    markdown += `- **8-9 clients**: ~85-88% success rate, increased processing times\n`;
    markdown += `- **10 clients**: 40% success rate, high variability in successful runs\n\n`;

    return markdown;
}

function main() {
    console.log('Creating complete analysis with correct processing metrics...');
    
    const analyses: CompleteCombinedResult[] = [];
    
    for (let clientNum = 1; clientNum <= 10; clientNum++) {
        const analysis = analyzeClientComplete(clientNum);
        analyses.push(analysis);
    }
    
    // Generate report
    const report = generateCompleteReport(analyses);
    const reportPath = path.join(__dirname, '../../complete-analysis-fixed.md');
    fs.writeFileSync(reportPath, report);
    
    // Generate comprehensive CSV
    let csvContent = 'Clients,Total_Runs,Successful_Runs,Failed_Runs,Success_Rate_Percent,';
    csvContent += 'Avg_Latency_With_Failures_ms,Avg_Latency_Successful_Only_ms,Median_Latency_Successful_ms,';
    csvContent += 'Min_Latency_Successful_ms,Max_Latency_Successful_ms,StdDev_Latency_Successful_ms,';
    csvContent += 'Avg_Add_Event_ms,StdDev_Add_Event_ms,Avg_Fetch_Event_ms,StdDev_Fetch_Event_ms,';
    csvContent += 'Avg_Preprocess_ms,StdDev_Preprocess_ms,Total_Preprocess_ms,';
    csvContent += 'Total_Add_Events,Total_Fetch_Events,Total_Preprocess_Events,Avg_Events_Per_Run\n';
    
    analyses.forEach(analysis => {
        csvContent += `${analysis.client},${analysis.totalRuns},${analysis.successfulRuns},${analysis.failedRuns},${analysis.successRate.toFixed(1)},`;
        csvContent += `${analysis.avgLatencyWithFailures.toFixed(0)},${analysis.avgLatencySuccessfulOnly.toFixed(0)},${analysis.medianLatencySuccessfulOnly.toFixed(0)},`;
        csvContent += `${analysis.minLatencySuccessfulOnly.toFixed(0)},${analysis.maxLatencySuccessfulOnly.toFixed(0)},${analysis.stdDevLatencySuccessfulOnly.toFixed(0)},`;
        csvContent += `${analysis.avgAddEventTime.toFixed(2)},${analysis.stdDevAddEventTime.toFixed(2)},${analysis.avgFetchEventTime.toFixed(2)},${analysis.stdDevFetchEventTime.toFixed(2)},`;
        csvContent += `${analysis.avgPreprocessTime.toFixed(2)},${analysis.stdDevPreprocessTime.toFixed(2)},${analysis.totalPreprocessTime.toFixed(0)},`;
        csvContent += `${analysis.totalAddEventCalls},${analysis.totalFetchEventCalls},${analysis.totalPreprocessCalls},${analysis.avgEventsPerRun.toFixed(0)}\n`;
    });
    
    const csvPath = path.join(__dirname, '../../complete-analysis-fixed.csv');
    fs.writeFileSync(csvPath, csvContent);

    console.log(`\nComplete analysis (fixed) saved to:`);
    console.log(`Markdown: ${reportPath}`);
    console.log(`CSV: ${csvPath}`);
    
    console.log('\nProcessing Metrics Summary:');
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            console.log(`${analysis.client} clients: ${analysis.successfulRuns}/${analysis.totalRuns} success, Avg preprocess: ${analysis.avgPreprocessTime.toFixed(1)}ms, Events/run: ${analysis.avgEventsPerRun.toFixed(0)}`);
        }
    });
}

main();
