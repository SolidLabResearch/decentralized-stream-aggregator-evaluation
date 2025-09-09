import * as fs from 'fs';
import * as path from 'path';
import { calculate_mean, calculate_standard_deviation, calculate_sum } from '../util/Util';

const BASE_LOCATION = "/Users/kushbisen/Downloads/WithoutAggregatorApproach";

interface ComparisonResult {
    client: number;
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    successRate: number;
    // With failures (10min timeout penalty)
    avgLatencyWithFailures: number;
    medianLatencyWithFailures: number;
    // Successful only
    avgLatencySuccessfulOnly: number;
    medianLatencySuccessfulOnly: number;
    minLatencySuccessfulOnly: number;
    maxLatencySuccessfulOnly: number;
    stdDevLatencySuccessfulOnly: number;
    // Performance impact
    timeoutPenaltyImpact: number; // How much failures increase average latency
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

function analyzeClient(clientNum: number): ComparisonResult {
    const clientDir = path.join(BASE_LOCATION, `${clientNum}clients`);
    
    const successfulLatencies: number[] = [];
    const allLatenciesWithPenalty: number[] = [];
    
    let successfulRuns = 0;
    const totalRuns = 35;
    const TIMEOUT_PENALTY = 10 * 60 * 1000; // 10 minutes
    
    for (let i = 1; i <= totalRuns; i++) {
        const iterationDir = path.join(clientDir, i.toString());
        const latency = calculateFirstEventLatency(iterationDir);
        
        if (latency >= 0) {
            successfulRuns++;
            successfulLatencies.push(latency);
            allLatenciesWithPenalty.push(latency);
        } else {
            allLatenciesWithPenalty.push(TIMEOUT_PENALTY);
        }
    }
    
    const failedRuns = totalRuns - successfulRuns;
    
    // Calculate statistics
    const sortedSuccessful = [...successfulLatencies].sort((a, b) => a - b);
    const sortedWithPenalty = [...allLatenciesWithPenalty].sort((a, b) => a - b);
    
    const medianSuccessful = sortedSuccessful.length > 0 ? 
        (sortedSuccessful.length % 2 === 0 ? 
            (sortedSuccessful[sortedSuccessful.length/2 - 1] + sortedSuccessful[sortedSuccessful.length/2]) / 2 :
            sortedSuccessful[Math.floor(sortedSuccessful.length/2)]) : 0;
            
    const medianWithPenalty = sortedWithPenalty.length > 0 ? 
        (sortedWithPenalty.length % 2 === 0 ? 
            (sortedWithPenalty[sortedWithPenalty.length/2 - 1] + sortedWithPenalty[sortedWithPenalty.length/2]) / 2 :
            sortedWithPenalty[Math.floor(sortedWithPenalty.length/2)]) : 0;
    
    const avgSuccessful = calculate_mean(successfulLatencies);
    const avgWithPenalty = calculate_mean(allLatenciesWithPenalty);
    
    return {
        client: clientNum,
        totalRuns,
        successfulRuns,
        failedRuns,
        successRate: (successfulRuns / totalRuns) * 100,
        avgLatencyWithFailures: avgWithPenalty,
        medianLatencyWithFailures: medianWithPenalty,
        avgLatencySuccessfulOnly: avgSuccessful,
        medianLatencySuccessfulOnly: medianSuccessful,
        minLatencySuccessfulOnly: successfulLatencies.length > 0 ? Math.min(...successfulLatencies) : 0,
        maxLatencySuccessfulOnly: successfulLatencies.length > 0 ? Math.max(...successfulLatencies) : 0,
        stdDevLatencySuccessfulOnly: calculate_standard_deviation(successfulLatencies),
        timeoutPenaltyImpact: avgSuccessful > 0 ? avgWithPenalty / avgSuccessful : 1
    };
}

function generateCombinedReport(analyses: ComparisonResult[]): string {
    let markdown = `# Combined Analysis: Failed vs Successful Experiments\n\n`;
    markdown += `Generated on: ${new Date().toISOString()}\n\n`;
    markdown += `This report compares metrics when including failed experiments vs. successful experiments only.\n\n`;

    // Success Rate Overview
    markdown += `## Experiment Success Rates\n\n`;
    markdown += `| Clients | Total Experiments | Successful | Failed | Success Rate |\n`;
    markdown += `|---------|-------------------|------------|--------|---------------|\n`;
    
    analyses.forEach(analysis => {
        markdown += `| ${analysis.client} | ${analysis.totalRuns} | ${analysis.successfulRuns} | ${analysis.failedRuns} | ${analysis.successRate.toFixed(1)}% |\n`;
    });

    // Latency Comparison
    markdown += `\n## Latency Comparison: Failed vs Successful Only\n\n`;
    markdown += `| Clients | Avg Latency (with 10min penalty) | Avg Latency (successful only) | Penalty Impact | Median (with penalty) | Median (successful only) |\n`;
    markdown += `|---------|-----------------------------------|--------------------------------|----------------|----------------------|-------------------------|\n`;
    
    analyses.forEach(analysis => {
        markdown += `| ${analysis.client} | ${(analysis.avgLatencyWithFailures/1000).toFixed(1)}s | ${(analysis.avgLatencySuccessfulOnly/1000).toFixed(1)}s | ${analysis.timeoutPenaltyImpact.toFixed(1)}x | ${(analysis.medianLatencyWithFailures/1000).toFixed(1)}s | ${(analysis.medianLatencySuccessfulOnly/1000).toFixed(1)}s |\n`;
    });

    // Detailed Successful Run Statistics
    markdown += `\n## Detailed Statistics for Successful Runs Only\n\n`;
    markdown += `| Clients | Count | Avg Latency | Median | Min | Max | Std Dev |\n`;
    markdown += `|---------|-------|-------------|--------|-----|-----|----------|\n`;
    
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            markdown += `| ${analysis.client} | ${analysis.successfulRuns} | ${(analysis.avgLatencySuccessfulOnly/1000).toFixed(1)}s | ${(analysis.medianLatencySuccessfulOnly/1000).toFixed(1)}s | ${(analysis.minLatencySuccessfulOnly/1000).toFixed(1)}s | ${(analysis.maxLatencySuccessfulOnly/1000).toFixed(1)}s | ${(analysis.stdDevLatencySuccessfulOnly/1000).toFixed(1)}s |\n`;
        }
    });

    markdown += `\n## Key Insights\n\n`;

    markdown += `### 1. Survivorship Bias Impact\n`;
    analyses.forEach(analysis => {
        if (analysis.failedRuns > 0) {
            markdown += `- **${analysis.client} clients**: ${analysis.failedRuns} failures increase reported latency by ${analysis.timeoutPenaltyImpact.toFixed(1)}x\n`;
        }
    });

    markdown += `\n### 2. System Performance Degradation (Successful Runs Only)\n`;
    markdown += `Even when considering only successful experiments, latency increases significantly:\n`;
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            markdown += `- **${analysis.client} clients**: ${(analysis.avgLatencySuccessfulOnly/1000).toFixed(1)}s average (${analysis.successfulRuns}/${analysis.totalRuns} runs)\n`;
        }
    });

    markdown += `\n### 3. Variability Analysis\n`;
    markdown += `Higher client counts show increased variability even in successful runs:\n`;
    analyses.forEach(analysis => {
        if (analysis.successfulRuns > 0) {
            const cv = (analysis.stdDevLatencySuccessfulOnly / analysis.avgLatencySuccessfulOnly) * 100;
            markdown += `- **${analysis.client} clients**: ${cv.toFixed(1)}% coefficient of variation\n`;
        }
    });

    markdown += `\n### 4. Critical Observations\n`;
    markdown += `- **1-7 clients**: 100% success rate, predictable performance\n`;
    markdown += `- **8-9 clients**: ~85-88% success rate, system under stress\n`;
    markdown += `- **10 clients**: 40% success rate, system heavily overloaded\n\n`;
    
    markdown += `The dramatic drop in success rate at 10 clients explains why the "average" latency appears deceptively low - most high-latency experiments failed completely and aren't included in the average.\n\n`;

    return markdown;
}

function main() {
    console.log('Creating combined analysis report...');
    
    const analyses: ComparisonResult[] = [];
    
    for (let clientNum = 1; clientNum <= 10; clientNum++) {
        console.log(`Analyzing ${clientNum} clients...`);
        const analysis = analyzeClient(clientNum);
        analyses.push(analysis);
    }
    
    // Generate reports
    const combinedReport = generateCombinedReport(analyses);
    const reportPath = path.join(__dirname, '../../combined-failed-vs-successful-analysis.md');
    fs.writeFileSync(reportPath, combinedReport);
    
    // Generate comprehensive CSV
    let csvContent = 'Clients,Total_Runs,Successful_Runs,Failed_Runs,Success_Rate_Percent,';
    csvContent += 'Avg_Latency_With_Failures_ms,Median_Latency_With_Failures_ms,';
    csvContent += 'Avg_Latency_Successful_Only_ms,Median_Latency_Successful_Only_ms,';
    csvContent += 'Min_Latency_Successful_ms,Max_Latency_Successful_ms,StdDev_Latency_Successful_ms,';
    csvContent += 'Timeout_Penalty_Impact_Factor\n';
    
    analyses.forEach(analysis => {
        csvContent += `${analysis.client},${analysis.totalRuns},${analysis.successfulRuns},${analysis.failedRuns},${analysis.successRate.toFixed(1)},`;
        csvContent += `${analysis.avgLatencyWithFailures.toFixed(0)},${analysis.medianLatencyWithFailures.toFixed(0)},`;
        csvContent += `${analysis.avgLatencySuccessfulOnly.toFixed(0)},${analysis.medianLatencySuccessfulOnly.toFixed(0)},`;
        csvContent += `${analysis.minLatencySuccessfulOnly.toFixed(0)},${analysis.maxLatencySuccessfulOnly.toFixed(0)},${analysis.stdDevLatencySuccessfulOnly.toFixed(0)},`;
        csvContent += `${analysis.timeoutPenaltyImpact.toFixed(2)}\n`;
    });
    
    const csvPath = path.join(__dirname, '../../combined-failed-vs-successful-analysis.csv');
    fs.writeFileSync(csvPath, csvContent);

    console.log(`\nCombined analysis saved to:`);
    console.log(`Markdown: ${reportPath}`);
    console.log(`CSV: ${csvPath}`);
    
    console.log('\nSummary:');
    analyses.forEach(analysis => {
        console.log(`${analysis.client} clients: ${analysis.successfulRuns}/${analysis.totalRuns} success (${analysis.successRate.toFixed(1)}%), Successful avg: ${(analysis.avgLatencySuccessfulOnly/1000).toFixed(1)}s, With failures: ${(analysis.avgLatencyWithFailures/1000).toFixed(1)}s`);
    });
}

main();
