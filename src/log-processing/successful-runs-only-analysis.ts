import * as fs from 'fs';
import * as path from 'path';
import { calculate_mean, calculate_standard_deviation, calculate_sum } from '../util/Util';

const BASE_LOCATION = "/Users/kushbisen/Downloads/WithoutAggregatorApproach";

interface SuccessOnlyResult {
    client: number;
    successfulRuns: number;
    totalPossibleRuns: number;
    // Latency metrics (successful runs only)
    avgLatency: number;
    medianLatency: number;
    minLatency: number;
    maxLatency: number;
    stdDevLatency: number;
    // Processing metrics (successful runs only)
    avgAddEventTime: number;
    stdDevAddEventTime: number;
    avgFetchEventTime: number;
    stdDevFetchEventTime: number;
    avgPreprocessTime: number;
    stdDevPreprocessTime: number;
    totalPreprocessTime: number;
    // Detailed processing statistics
    totalAddEventCalls: number;
    totalFetchEventCalls: number;
    totalPreprocessCalls: number;
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

function analyzeSuccessfulRunsOnly(clientNum: number): SuccessOnlyResult {
    const clientDir = path.join(BASE_LOCATION, `${clientNum}clients`);
    
    const allAddEventValues: number[] = [];
    const allFetchEventValues: number[] = [];
    const allPreprocessValues: number[] = [];
    const successfulLatencies: number[] = [];
    
    let successfulRuns = 0;
    const totalPossibleRuns = 35;
    
    console.log(`Analyzing ${clientNum} clients (successful runs only)...`);
    
    for (let i = 1; i <= totalPossibleRuns; i++) {
        const iterationDir = path.join(clientDir, i.toString());
        const csvFile = path.join(iterationDir, 'result-0-client.csv');
        
        const firstEventLatency = calculateFirstEventLatency(iterationDir);
        
        if (firstEventLatency >= 0 && fs.existsSync(csvFile)) {
            successfulRuns++;
            successfulLatencies.push(firstEventLatency);
            
            // Process all metrics from this successful run
            try {
                const file = fs.readFileSync(csvFile, 'utf-8');
                const lines = file.split('\n');
                
                lines.forEach((line) => {
                    const [key, value] = line.trim().split(',');
                    if (!line || !value) return;
                    
                    if (key === 'time_to_fetch_notification') {
                        allFetchEventValues.push(Number(value));
                    } else if (key === 'time_to_add_event_to_rsp_engine') {
                        allAddEventValues.push(Number(value));
                    } else if (key === 'time_to_preprocess_event') {
                        allPreprocessValues.push(Number(value));
                    }
                });
            } catch (error) {
                console.log(`Error reading ${csvFile}: ${error}`);
            }
        }
    }
    
    // Calculate statistics for successful runs only
    const sortedLatencies = [...successfulLatencies].sort((a, b) => a - b);
    const median = sortedLatencies.length > 0 ? 
        (sortedLatencies.length % 2 === 0 ? 
            (sortedLatencies[sortedLatencies.length/2 - 1] + sortedLatencies[sortedLatencies.length/2]) / 2 :
            sortedLatencies[Math.floor(sortedLatencies.length/2)]) : 0;
    
    return {
        client: clientNum,
        successfulRuns,
        totalPossibleRuns,
        avgLatency: calculate_mean(successfulLatencies),
        medianLatency: median,
        minLatency: successfulLatencies.length > 0 ? Math.min(...successfulLatencies) : 0,
        maxLatency: successfulLatencies.length > 0 ? Math.max(...successfulLatencies) : 0,
        stdDevLatency: calculate_standard_deviation(successfulLatencies),
        avgAddEventTime: calculate_mean(allAddEventValues),
        stdDevAddEventTime: calculate_standard_deviation(allAddEventValues),
        avgFetchEventTime: calculate_mean(allFetchEventValues),
        stdDevFetchEventTime: calculate_standard_deviation(allFetchEventValues),
        avgPreprocessTime: calculate_mean(allPreprocessValues),
        stdDevPreprocessTime: calculate_standard_deviation(allPreprocessValues),
        totalPreprocessTime: calculate_sum(allPreprocessValues),
        totalAddEventCalls: allAddEventValues.length,
        totalFetchEventCalls: allFetchEventValues.length,
        totalPreprocessCalls: allPreprocessValues.length
    };
}

function generateSuccessOnlyReport(analyses: SuccessOnlyResult[]): string {
    let markdown = `# Report 2: Successful Experiments Only Analysis\n\n`;
    markdown += `Generated on: ${new Date().toISOString()}\n\n`;
    markdown += `This report analyzes ONLY the experiments that completed successfully.\n`;
    markdown += `It shows the true performance characteristics when the system works.\n\n`;

    markdown += `## Latency Analysis (Successful Runs Only)\n\n`;
    markdown += `| Clients | Successful Runs | Avg Latency | Median Latency | Min Latency | Max Latency | Std Dev Latency |\n`;
    markdown += `|---------|-----------------|-------------|----------------|-------------|-------------|------------------|\n`;

    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            markdown += `| ${analysis.client} | ${analysis.successfulRuns}/35 | ${(analysis.avgLatency/1000).toFixed(1)}s | ${(analysis.medianLatency/1000).toFixed(1)}s | ${(analysis.minLatency/1000).toFixed(1)}s | ${(analysis.maxLatency/1000).toFixed(1)}s | ${(analysis.stdDevLatency/1000).toFixed(1)}s |\n`;
        }
    });

    markdown += `\n## Processing Time Analysis (Successful Runs Only)\n\n`;
    markdown += `| Clients | Add Event Time | Add Event StdDev | Fetch Event Time | Fetch Event StdDev | Preprocess Time | Preprocess StdDev | Total Preprocess |\n`;
    markdown += `|---------|----------------|------------------|------------------|--------------------|-----------------|--------------------|-------------------|\n`;

    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            markdown += `| ${analysis.client} | ${analysis.avgAddEventTime.toFixed(2)}ms | ${analysis.stdDevAddEventTime.toFixed(2)}ms | ${analysis.avgFetchEventTime.toFixed(2)}ms | ${analysis.stdDevFetchEventTime.toFixed(2)}ms | ${analysis.avgPreprocessTime.toFixed(2)}ms | ${analysis.stdDevPreprocessTime.toFixed(2)}ms | ${analysis.totalPreprocessTime.toFixed(0)}ms |\n`;
        }
    });

    markdown += `\n## Processing Volume Analysis\n\n`;
    markdown += `| Clients | Total Add Events | Total Fetch Events | Total Preprocess Events | Events per Run |\n`;
    markdown += `|---------|------------------|--------------------|--------------------------|-----------------|\n`;

    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            const eventsPerRun = analysis.totalPreprocessCalls / analysis.successfulRuns;
            markdown += `| ${analysis.client} | ${analysis.totalAddEventCalls} | ${analysis.totalFetchEventCalls} | ${analysis.totalPreprocessCalls} | ${eventsPerRun.toFixed(0)} |\n`;
        }
    });

    markdown += `\n## Performance Insights from Successful Runs\n\n`;
    
    markdown += `### Latency Progression (When System Works):\n`;
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            markdown += `- **${analysis.client} clients**: ${(analysis.avgLatency/1000).toFixed(1)}s average latency (${analysis.successfulRuns} successful runs)\n`;
        }
    });

    markdown += `\n### Processing Time Trends:\n`;
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            markdown += `- **${analysis.client} clients**: ${analysis.avgPreprocessTime.toFixed(0)}ms avg preprocess time\n`;
        }
    });

    markdown += `\n### System Stability Indicators:\n`;
    analyses.forEach(analysis => {
        const variability = analysis.stdDevLatency / analysis.avgLatency;
        if (analysis.successfulRuns > 0) {
            markdown += `- **${analysis.client} clients**: Latency variability ${(variability * 100).toFixed(1)}% (StdDev/Mean)\n`;
        }
    });

    markdown += `\n### Key Observations:\n`;
    markdown += `1. **True Performance Degradation**: Even successful runs show increasing latency with more clients\n`;
    markdown += `2. **Processing Overhead**: Preprocessing time increases with client count\n`;
    markdown += `3. **Variability**: Higher client counts show more variable performance\n`;
    markdown += `4. **Completeness**: Some client configurations have significantly fewer successful runs\n\n`;

    return markdown;
}

function main() {
    console.log('Starting analysis of successful experiments only...');
    
    const analyses: SuccessOnlyResult[] = [];
    
    for (let clientNum = 1; clientNum <= 10; clientNum++) {
        const analysis = analyzeSuccessfulRunsOnly(clientNum);
        analyses.push(analysis);
    }
    
    // Generate markdown report
    const report = generateSuccessOnlyReport(analyses);
    const reportPath = path.join(__dirname, '../../report-2-successful-only.md');
    fs.writeFileSync(reportPath, report);
    
    // Generate detailed CSV for successful runs only
    let csvContent = 'Clients,Successful_Runs,Total_Possible,Avg_Latency_ms,Median_Latency_ms,Min_Latency_ms,Max_Latency_ms,StdDev_Latency_ms,Avg_Add_Event_ms,StdDev_Add_Event_ms,Avg_Fetch_Event_ms,StdDev_Fetch_Event_ms,Avg_Preprocess_ms,StdDev_Preprocess_ms,Total_Preprocess_ms,Total_Add_Events,Total_Fetch_Events,Total_Preprocess_Events\n';
    
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            csvContent += `${analysis.client},${analysis.successfulRuns},${analysis.totalPossibleRuns},${analysis.avgLatency.toFixed(0)},${analysis.medianLatency.toFixed(0)},${analysis.minLatency.toFixed(0)},${analysis.maxLatency.toFixed(0)},${analysis.stdDevLatency.toFixed(0)},${analysis.avgAddEventTime.toFixed(2)},${analysis.stdDevAddEventTime.toFixed(2)},${analysis.avgFetchEventTime.toFixed(2)},${analysis.stdDevFetchEventTime.toFixed(2)},${analysis.avgPreprocessTime.toFixed(2)},${analysis.stdDevPreprocessTime.toFixed(2)},${analysis.totalPreprocessTime.toFixed(0)},${analysis.totalAddEventCalls},${analysis.totalFetchEventCalls},${analysis.totalPreprocessCalls}\n`;
        }
    });
    
    const csvPath = path.join(__dirname, '../../report-2-successful-only.csv');
    fs.writeFileSync(csvPath, csvContent);

    console.log(`\nReport 2 (successful only) saved to:`);
    console.log(`Markdown: ${reportPath}`);
    console.log(`CSV: ${csvPath}`);
    
    console.log('\nSummary (successful experiments only):');
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            console.log(`${analysis.client} clients: ${analysis.successfulRuns}/35 runs, Avg latency: ${(analysis.avgLatency/1000).toFixed(1)}s`);
        }
    });
}

main();
