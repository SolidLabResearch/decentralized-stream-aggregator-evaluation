import * as fs from 'fs';
import * as path from 'path';
import { calculate_mean, calculate_standard_deviation, calculate_sum } from '../util/Util';

const BASE_LOCATION = "/Users/kushbisen/Downloads/WithoutAggregatorApproach";

interface AnalysisResult {
    client: number;
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    successRate: number;
    // Metrics including failed runs (failed = timeout penalty)
    avgLatencyWithFailures: number;
    medianLatencyWithFailures: number;
    stdDevLatencyWithFailures: number;
    // Processing metrics (successful runs only)
    avgAddEventTime: number;
    avgFetchEventTime: number;
    avgPreprocessTime: number;
    totalPreprocessTime: number;
    // Raw data for analysis
    allLatencies: number[];
    successfulLatencies: number[];
}

function calculateFirstEventLatency(iterationDir: string): number {
    const csparlWindowLogPath = path.join(iterationDir, 'CSPARQLWindow.log');
    const resultCsvPath = path.join(iterationDir, 'result-0-client.csv');
    
    try {
        if (!fs.existsSync(resultCsvPath) || !fs.existsSync(csparlWindowLogPath)) {
            return -1; // Failed experiment
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

function analyzeClientWithFailures(clientNum: number): AnalysisResult {
    const clientDir = path.join(BASE_LOCATION, `${clientNum}clients`);
    
    const allAddEventValues: number[] = [];
    const allFetchEventValues: number[] = [];
    const allPreprocessValues: number[] = [];
    const successfulLatencies: number[] = [];
    const allLatencies: number[] = []; // Includes penalty for failures
    
    let successfulRuns = 0;
    const totalRuns = 35;
    const TIMEOUT_PENALTY = 10 * 60 * 1000; // 10 minutes in milliseconds (reasonable timeout)
    
    console.log(`Analyzing ${clientNum} clients (including failures)...`);
    
    for (let i = 1; i <= totalRuns; i++) {
        const iterationDir = path.join(clientDir, i.toString());
        const csvFile = path.join(iterationDir, 'result-0-client.csv');
        
        const firstEventLatency = calculateFirstEventLatency(iterationDir);
        
        if (firstEventLatency >= 0 && fs.existsSync(csvFile)) {
            // Successful run
            successfulRuns++;
            successfulLatencies.push(firstEventLatency);
            allLatencies.push(firstEventLatency);
            
            // Process metrics from successful runs
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
        } else {
            // Failed run - assign timeout penalty
            allLatencies.push(TIMEOUT_PENALTY);
        }
    }
    
    const failedRuns = totalRuns - successfulRuns;
    const sortedAllLatencies = [...allLatencies].sort((a, b) => a - b);
    const medianAll = sortedAllLatencies.length > 0 ? 
        (sortedAllLatencies.length % 2 === 0 ? 
            (sortedAllLatencies[sortedAllLatencies.length/2 - 1] + sortedAllLatencies[sortedAllLatencies.length/2]) / 2 :
            sortedAllLatencies[Math.floor(sortedAllLatencies.length/2)]) : 0;
    
    return {
        client: clientNum,
        totalRuns,
        successfulRuns,
        failedRuns,
        successRate: (successfulRuns / totalRuns) * 100,
        avgLatencyWithFailures: calculate_mean(allLatencies),
        medianLatencyWithFailures: medianAll,
        stdDevLatencyWithFailures: calculate_standard_deviation(allLatencies),
        avgAddEventTime: calculate_mean(allAddEventValues),
        avgFetchEventTime: calculate_mean(allFetchEventValues),
        avgPreprocessTime: calculate_mean(allPreprocessValues),
        totalPreprocessTime: calculate_sum(allPreprocessValues),
        allLatencies,
        successfulLatencies
    };
}

function generateReportWithFailures(analyses: AnalysisResult[]): string {
    let markdown = `# Report 1: Complete Analysis Including Failed Experiments\n\n`;
    markdown += `Generated on: ${new Date().toISOString()}\n\n`;
    markdown += `This report includes ALL experiments. Failed experiments are assigned a ${10} minute timeout penalty.\n\n`;

    markdown += `## Performance Impact Including Failures\n\n`;
    markdown += `| Clients | Total | Success | Failed | Success Rate | Avg Latency (with failures) | Median Latency | Std Dev | Avg Add Event | Avg Fetch Event | Avg Preprocess | Total Preprocess |\n`;
    markdown += `|---------|-------|---------|--------|--------------|------------------------------|----------------|---------|---------------|-----------------|----------------|------------------|\n`;

    analyses.forEach(analysis => {
        markdown += `| ${analysis.client} | ${analysis.totalRuns} | ${analysis.successfulRuns} | ${analysis.failedRuns} | ${analysis.successRate.toFixed(1)}% | ${(analysis.avgLatencyWithFailures/1000).toFixed(1)}s | ${(analysis.medianLatencyWithFailures/1000).toFixed(1)}s | ${(analysis.stdDevLatencyWithFailures/1000).toFixed(1)}s | ${analysis.avgAddEventTime.toFixed(2)}ms | ${analysis.avgFetchEventTime.toFixed(2)}ms | ${analysis.avgPreprocessTime.toFixed(2)}ms | ${analysis.totalPreprocessTime.toFixed(0)}ms |\n`;
    });

    markdown += `\n## Key Insights from Complete Analysis\n\n`;
    markdown += `### True Performance Degradation:\n`;
    markdown += `When including failed experiments (with 10-minute timeout penalty):\n\n`;
    
    analyses.forEach(analysis => {
        if (analysis.failedRuns > 0) {
            const impactFactor = analysis.avgLatencyWithFailures / (calculate_mean(analysis.successfulLatencies) || 1);
            markdown += `- **${analysis.client} clients**: ${analysis.failedRuns} failed experiments increase average latency by ${impactFactor.toFixed(1)}x\n`;
        } else {
            markdown += `- **${analysis.client} clients**: No failures, true performance = ${(calculate_mean(analysis.successfulLatencies)/1000).toFixed(1)}s\n`;
        }
    });

    markdown += `\n### System Overload Pattern:\n`;
    markdown += `The data shows clear system overload starting at 8 clients:\n`;
    analyses.forEach(analysis => {
        if (analysis.failedRuns > 0) {
            markdown += `- ${analysis.client} clients: ${analysis.failedRuns}/35 experiments failed (${(analysis.failedRuns/35*100).toFixed(1)}%)\n`;
        }
    });

    markdown += `\n### Processing Time Analysis (Successful Runs Only):\n`;
    markdown += `Even in successful runs, processing times increase with client count:\n`;
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            markdown += `- ${analysis.client} clients: Avg preprocess time ${analysis.avgPreprocessTime.toFixed(0)}ms, Total: ${analysis.totalPreprocessTime.toFixed(0)}ms\n`;
        }
    });

    return markdown;
}

function main() {
    console.log('Starting comprehensive analysis including failed experiments...');
    
    const analyses: AnalysisResult[] = [];
    
    for (let clientNum = 1; clientNum <= 10; clientNum++) {
        const analysis = analyzeClientWithFailures(clientNum);
        analyses.push(analysis);
    }
    
    // Generate markdown report
    const report = generateReportWithFailures(analyses);
    const reportPath = path.join(__dirname, '../../report-1-with-failures.md');
    fs.writeFileSync(reportPath, report);
    
    // Generate CSV with failures
    let csvContent = 'Clients,Total_Runs,Successful_Runs,Failed_Runs,Success_Rate_Percent,Avg_Latency_With_Failures_ms,Median_Latency_With_Failures_ms,StdDev_Latency_With_Failures_ms,Avg_Add_Event_ms,Avg_Fetch_Event_ms,Avg_Preprocess_ms,Total_Preprocess_ms\n';
    analyses.forEach(analysis => {
        csvContent += `${analysis.client},${analysis.totalRuns},${analysis.successfulRuns},${analysis.failedRuns},${analysis.successRate.toFixed(1)},${analysis.avgLatencyWithFailures.toFixed(0)},${analysis.medianLatencyWithFailures.toFixed(0)},${analysis.stdDevLatencyWithFailures.toFixed(0)},${analysis.avgAddEventTime.toFixed(2)},${analysis.avgFetchEventTime.toFixed(2)},${analysis.avgPreprocessTime.toFixed(2)},${analysis.totalPreprocessTime.toFixed(0)}\n`;
    });
    
    const csvPath = path.join(__dirname, '../../report-1-with-failures.csv');
    fs.writeFileSync(csvPath, csvContent);

    console.log(`\nReport 1 (with failures) saved to:`);
    console.log(`Markdown: ${reportPath}`);
    console.log(`CSV: ${csvPath}`);
    
    console.log('\nSummary (including 10min timeout penalty for failures):');
    analyses.forEach(analysis => {
        console.log(`${analysis.client} clients: ${analysis.successfulRuns}/${analysis.totalRuns} success, Avg latency: ${(analysis.avgLatencyWithFailures/1000).toFixed(1)}s`);
    });
}

main();
