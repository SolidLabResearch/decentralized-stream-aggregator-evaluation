import * as fs from 'fs';
import * as path from 'path';
import { calculate_mean, calculate_standard_deviation, find_maximum, find_minimum, calculate_sum } from '../util/Util';

const BASE_LOCATION = "/Users/kushbisen/Downloads/WithoutAggregatorApproach";

interface ClientAnalysis {
    client: number;
    totalIterations: number;
    successfulIterations: number;
    failedIterations: number;
    successRate: number;
    averageLatency: number;
    medianLatency: number;
    minLatency: number;
    maxLatency: number;
    stdDevLatency: number;
}

function calculateFirstEventLatency(iterationDir: string): number {
    const csparlWindowLogPath = path.join(iterationDir, 'CSPARQLWindow.log');
    const resultCsvPath = path.join(iterationDir, 'result-0-client.csv');
    
    try {
        if (!fs.existsSync(resultCsvPath)) {
            return -1; // Indicates failed experiment
        }
        
        // Get first event addition timestamp from CSPARQLWindow.log
        const windowLog = fs.readFileSync(csparlWindowLogPath, 'utf-8');
        const windowLines = windowLog.split('\n');
        const firstEventLine = windowLines.find(line => line.includes('adding_event_to_the_window'));
        const firstEventTimestamp = firstEventLine?.split(',')[0];
        
        if (!firstEventTimestamp) {
            return -1;
        }
        
        // Get first result timestamp from result-0-client.csv
        const resultCsv = fs.readFileSync(resultCsvPath, 'utf-8');
        const resultLines = resultCsv.split('\n');
        const firstResultLine = resultLines.find(line => line.trim() && /^\d+,/.test(line));
        const firstResultTimestamp = firstResultLine?.split(',')[0];
        
        if (!firstResultTimestamp) {
            return -1;
        }
        
        // Calculate latency in milliseconds
        const latency = parseInt(firstResultTimestamp) - parseInt(firstEventTimestamp);
        return Math.max(0, latency);
        
    } catch (error) {
        return -1; // Indicates failed experiment
    }
}

function analyzeClientPerformance(): ClientAnalysis[] {
    const results: ClientAnalysis[] = [];
    
    for (let clientNum = 1; clientNum <= 10; clientNum++) {
        const clientDir = path.join(BASE_LOCATION, `${clientNum}clients`);
        const latencies: number[] = [];
        let successful = 0;
        let failed = 0;
        
        // Check all 35 iterations
        for (let i = 1; i <= 35; i++) {
            const iterationDir = path.join(clientDir, i.toString());
            const latency = calculateFirstEventLatency(iterationDir);
            
            if (latency >= 0) {
                latencies.push(latency);
                successful++;
            } else {
                failed++;
            }
        }
        
        // Calculate statistics
        const sortedLatencies = latencies.sort((a, b) => a - b);
        const median = sortedLatencies.length > 0 ? 
            (sortedLatencies.length % 2 === 0 ? 
                (sortedLatencies[sortedLatencies.length/2 - 1] + sortedLatencies[sortedLatencies.length/2]) / 2 :
                sortedLatencies[Math.floor(sortedLatencies.length/2)]) : 0;
        
        results.push({
            client: clientNum,
            totalIterations: 35,
            successfulIterations: successful,
            failedIterations: failed,
            successRate: (successful / 35) * 100,
            averageLatency: latencies.length > 0 ? calculate_mean(latencies) : 0,
            medianLatency: median,
            minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
            maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
            stdDevLatency: latencies.length > 0 ? calculate_standard_deviation(latencies) : 0
        });
    }
    
    return results;
}

function generateSuccessFailureReport(analyses: ClientAnalysis[]): string {
    let markdown = `# Without Aggregator Approach - Success/Failure Analysis\n\n`;
    markdown += `Generated on: ${new Date().toISOString()}\n\n`;
    markdown += `This analysis reveals why latency appears low for higher client counts - many experiments failed to complete!\n\n`;

    // Success/Failure Table
    markdown += `## Success Rate Analysis\n\n`;
    markdown += `| Clients | Total Runs | Successful | Failed | Success Rate | Avg Latency (successful only) | Median Latency | Min Latency | Max Latency | Std Dev |\n`;
    markdown += `|---------|------------|------------|--------|--------------|-------------------------------|----------------|-------------|-------------|----------|\n`;

    analyses.forEach(analysis => {
        markdown += `| ${analysis.client} clients | ${analysis.totalIterations} | ${analysis.successfulIterations} | ${analysis.failedIterations} | ${analysis.successRate.toFixed(1)}% | ${analysis.averageLatency.toFixed(0)}ms | ${analysis.medianLatency.toFixed(0)}ms | ${analysis.minLatency.toFixed(0)}ms | ${analysis.maxLatency.toFixed(0)}ms | ${analysis.stdDevLatency.toFixed(0)}ms |\n`;
    });

    markdown += `\n## Key Insights\n\n`;
    markdown += `### Why 10 clients shows lower latency:\n`;
    markdown += `**Survivorship Bias**: Only ${analyses[9].successfulIterations}/35 (${analyses[9].successRate.toFixed(1)}%) experiments completed successfully.\n`;
    markdown += `The failed experiments likely had infinite latency (never completed) or timed out.\n\n`;
    
    markdown += `### Performance Degradation Pattern:\n`;
    analyses.forEach(analysis => {
        if (analysis.successRate < 50) {
            markdown += `- **${analysis.client} clients**: Only ${analysis.successRate.toFixed(1)}% success rate - system heavily overloaded\n`;
        } else if (analysis.successRate < 80) {
            markdown += `- **${analysis.client} clients**: ${analysis.successRate.toFixed(1)}% success rate - system showing stress\n`;
        } else {
            markdown += `- **${analysis.client} clients**: ${analysis.successRate.toFixed(1)}% success rate - system stable\n`;
        }
    });

    markdown += `\n### True Performance Impact:\n`;
    markdown += `If we consider failed experiments as having infinite latency, the true performance would be much worse for higher client counts.\n`;
    markdown += `The reported averages only reflect the "lucky" runs that managed to complete.\n\n`;

    return markdown;
}

function main() {
    console.log('Analyzing success/failure rates and survivorship bias...');
    
    const analyses = analyzeClientPerformance();
    
    // Generate report
    const report = generateSuccessFailureReport(analyses);
    
    // Write to file
    const outputPath = path.join(__dirname, '../../without-aggregator-success-failure-analysis.md');
    fs.writeFileSync(outputPath, report);

    // Also generate CSV
    let csvContent = 'Clients,Total_Runs,Successful,Failed,Success_Rate_Percent,Avg_Latency_ms,Median_Latency_ms,Min_Latency_ms,Max_Latency_ms,StdDev_Latency_ms\n';
    analyses.forEach(analysis => {
        csvContent += `${analysis.client},${analysis.totalIterations},${analysis.successfulIterations},${analysis.failedIterations},${analysis.successRate.toFixed(1)},${analysis.averageLatency.toFixed(0)},${analysis.medianLatency.toFixed(0)},${analysis.minLatency.toFixed(0)},${analysis.maxLatency.toFixed(0)},${analysis.stdDevLatency.toFixed(0)}\n`;
    });
    
    const csvOutputPath = path.join(__dirname, '../../without-aggregator-success-failure-analysis.csv');
    fs.writeFileSync(csvOutputPath, csvContent);

    console.log(`Success/Failure analysis saved to: ${outputPath}`);
    console.log(`Success/Failure CSV saved to: ${csvOutputPath}`);
    
    console.log('\nSuccess Rate Summary:');
    analyses.forEach(analysis => {
        console.log(`${analysis.client} clients: ${analysis.successfulIterations}/35 successful (${analysis.successRate.toFixed(1)}%)`);
    });
}

// Run the analysis
main();
