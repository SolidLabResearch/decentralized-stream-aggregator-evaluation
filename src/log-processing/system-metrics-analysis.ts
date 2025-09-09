import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { calculate_mean, calculate_standard_deviation, find_maximum, find_minimum } from '../util/Util';

const BASE_LOCATION = "/Users/kushbisen/Downloads/WithoutAggregatorApproach";
const CPU_CORES = 24; // Server has 24 logical CPUs (6 cores × 2 sockets × 2 threads per core)

console.log(`Analysis configured for ${CPU_CORES} CPU cores (server configuration)`);

interface SystemMetrics {
    timestamp: number;
    cpu_user: number;
    cpu_system: number;
    rss: number;        // Resident Set Size (physical memory)
    heapTotal: number;  // Total heap size
    heapUsed: number;   // Used heap size
    external: number;   // External memory
}

interface IterationSystemAnalysis {
    client: number;
    iteration: number;
    success: boolean;
    duration_seconds: number;
    // CPU metrics (as percentages)
    avg_cpu_user_percent: number;
    avg_cpu_system_percent: number;
    avg_cpu_total_percent: number;
    avg_cpu_total_per_core_percent: number; // Total CPU usage divided by number of cores
    max_cpu_total_percent: number;
    max_cpu_total_per_core_percent: number; // Max CPU usage divided by number of cores
    std_dev_cpu_total_percent: number;
    // Memory metrics (in MB)
    avg_rss_mb: number;
    max_rss_mb: number;
    avg_heap_used_mb: number;
    max_heap_used_mb: number;
    avg_heap_total_mb: number;
    max_heap_total_mb: number;
    heap_utilization_percent: number; // avg_heap_used / avg_heap_total * 100
    std_dev_rss_mb: number;
    std_dev_heap_used_mb: number;
}

interface ClientSystemSummary {
    client: number;
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    success_rate: number;
    // CPU averages across all successful iterations
    avg_cpu_total_percent: number;
    std_dev_cpu_total_percent: number;
    max_cpu_total_percent: number;
    // Memory averages across all successful iterations
    avg_rss_mb: number;
    std_dev_rss_mb: number;
    max_rss_mb: number;
    avg_heap_used_mb: number;
    std_dev_heap_used_mb: number;
    max_heap_used_mb: number;
    avg_heap_utilization_percent: number;
    std_dev_heap_utilization_percent: number;
    avg_duration_seconds: number;
    std_dev_duration_seconds: number;
}

function parseSystemMetrics(logFilePath: string): SystemMetrics[] {
    const metrics: SystemMetrics[] = [];
    
    try {
        if (!fs.existsSync(logFilePath)) {
            return metrics;
        }
        
        const content = fs.readFileSync(logFilePath, 'utf-8');
        const lines = content.split('\n');
        
        // Skip header line
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = line.split(', ');
            if (parts.length >= 7) {
                metrics.push({
                    timestamp: parseInt(parts[0]),
                    cpu_user: parseInt(parts[1]),
                    cpu_system: parseInt(parts[2]),
                    rss: parseInt(parts[3]),
                    heapTotal: parseInt(parts[4]),
                    heapUsed: parseInt(parts[5]),
                    external: parseInt(parts[6])
                });
            }
        }
    } catch (error) {
        console.log(`Error parsing ${logFilePath}: ${error}`);
    }
    
    return metrics;
}

function analyzeIterationSystemMetrics(clientNum: number, iteration: number): IterationSystemAnalysis | null {
    const iterationDir = path.join(BASE_LOCATION, `${clientNum}clients`, iteration.toString());
    const logFile = path.join(iterationDir, 'log-0.log');
    const resultFile = path.join(iterationDir, 'result-0-client.csv');
    
    const metrics = parseSystemMetrics(logFile);
    if (metrics.length === 0) {
        return null;
    }
    
    const success = fs.existsSync(resultFile);
    
    // Calculate duration
    const startTime = metrics[0].timestamp;
    const endTime = metrics[metrics.length - 1].timestamp;
    const duration = (endTime - startTime) / 1000; // Convert to seconds
    
    // Calculate CPU percentages using the difference between cumulative values
    // CPU values are cumulative, so we calculate the difference between consecutive readings
    // Formula: ((cpu_user_diff/1000)/500)*100 where cpu_user_diff is the difference
    const cpuUserPercents: number[] = [];
    const cpuSystemPercents: number[] = [];
    const cpuTotalPercents: number[] = [];
    
    let extremeValues = 0;
    
    for (let i = 1; i < metrics.length; i++) {
        // Calculate the difference in CPU time used between measurements
        const userDiff = metrics[i].cpu_user - metrics[i-1].cpu_user; // microseconds of CPU time used
        const systemDiff = metrics[i].cpu_system - metrics[i-1].cpu_system; // microseconds of CPU time used
        
        // Apply your formula: ((E_value/1000)/500)*100
        // E_value is the userDiff (CPU time used in this interval)
        const userPercent = ((userDiff / 1000) / 500) * 100;
        const systemPercent = ((systemDiff / 1000) / 500) * 100;
        
        // Check for extreme values (over 100% is suspicious for a single measurement)
        if (userPercent > 100 || systemPercent > 100) {
            extremeValues++;
            if (extremeValues < 5) { // Only log first few extreme values
                console.log(`Extreme CPU value at index ${i}: user=${userPercent.toFixed(2)}%, system=${systemPercent.toFixed(2)}%, userDiff=${userDiff}, systemDiff=${systemDiff}`);
            }
        }
        
        // Ensure non-negative values (in case of any anomalies)
        const userCapped = Math.max(0, userPercent);
        const systemCapped = Math.max(0, systemPercent);
        
        cpuUserPercents.push(userCapped);
        cpuSystemPercents.push(systemCapped);
        cpuTotalPercents.push(userCapped + systemCapped);
    }
    
    if (extremeValues > 0) {
        console.log(`Found ${extremeValues} extreme CPU values (>100%) in this dataset`);
    }
    
    // If we have no measurements, use zero
    if (cpuTotalPercents.length === 0) {
        cpuUserPercents.push(0);
        cpuSystemPercents.push(0);
        cpuTotalPercents.push(0);
    }
    
    // Convert memory to MB
    const rssMB = metrics.map(m => m.rss / (1024 * 1024));
    const heapUsedMB = metrics.map(m => m.heapUsed / (1024 * 1024));
    const heapTotalMB = metrics.map(m => m.heapTotal / (1024 * 1024));
    
    // Calculate heap utilization percentages
    const heapUtilizations = metrics.map(m => (m.heapUsed / m.heapTotal) * 100);
    
    return {
        client: clientNum,
        iteration,
        success,
        duration_seconds: duration,
        avg_cpu_user_percent: calculate_mean(cpuUserPercents),
        avg_cpu_system_percent: calculate_mean(cpuSystemPercents),
        avg_cpu_total_percent: calculate_mean(cpuTotalPercents),
        avg_cpu_total_per_core_percent: calculate_mean(cpuTotalPercents) / CPU_CORES,
        max_cpu_total_percent: find_maximum(cpuTotalPercents),
        max_cpu_total_per_core_percent: find_maximum(cpuTotalPercents) / CPU_CORES,
        std_dev_cpu_total_percent: calculate_standard_deviation(cpuTotalPercents),
        avg_rss_mb: calculate_mean(rssMB),
        max_rss_mb: find_maximum(rssMB),
        avg_heap_used_mb: calculate_mean(heapUsedMB),
        max_heap_used_mb: find_maximum(heapUsedMB),
        avg_heap_total_mb: calculate_mean(heapTotalMB),
        max_heap_total_mb: find_maximum(heapTotalMB),
        heap_utilization_percent: calculate_mean(heapUtilizations),
        std_dev_rss_mb: calculate_standard_deviation(rssMB),
        std_dev_heap_used_mb: calculate_standard_deviation(heapUsedMB)
    };
}

function analyzeClientSystemMetrics(clientNum: number): ClientSystemSummary {
    const iterations: IterationSystemAnalysis[] = [];
    
    console.log(`Analyzing system metrics for ${clientNum} clients...`);
    
    for (let i = 1; i <= 35; i++) {
        const analysis = analyzeIterationSystemMetrics(clientNum, i);
        if (analysis) {
            iterations.push(analysis);
        }
    }
    
    const successfulIterations = iterations.filter(i => i.success);
    const failedIterations = iterations.filter(i => !i.success);
    
    if (successfulIterations.length === 0) {
        // Return empty summary if no successful iterations
        return {
            client: clientNum,
            total_runs: iterations.length,
            successful_runs: 0,
            failed_runs: failedIterations.length,
            success_rate: 0,
            avg_cpu_total_percent: 0,
            std_dev_cpu_total_percent: 0,
            max_cpu_total_percent: 0,
            avg_rss_mb: 0,
            std_dev_rss_mb: 0,
            max_rss_mb: 0,
            avg_heap_used_mb: 0,
            std_dev_heap_used_mb: 0,
            max_heap_used_mb: 0,
            avg_heap_utilization_percent: 0,
            std_dev_heap_utilization_percent: 0,
            avg_duration_seconds: 0,
            std_dev_duration_seconds: 0
        };
    }
    
    // Calculate averages across successful iterations
    const cpuTotals = successfulIterations.map(i => i.avg_cpu_total_percent);
    const rssValues = successfulIterations.map(i => i.avg_rss_mb);
    const heapUsedValues = successfulIterations.map(i => i.avg_heap_used_mb);
    const heapUtilizations = successfulIterations.map(i => i.heap_utilization_percent);
    const durations = successfulIterations.map(i => i.duration_seconds);
    
    return {
        client: clientNum,
        total_runs: iterations.length,
        successful_runs: successfulIterations.length,
        failed_runs: failedIterations.length,
        success_rate: (successfulIterations.length / iterations.length) * 100,
        avg_cpu_total_percent: calculate_mean(cpuTotals),
        std_dev_cpu_total_percent: calculate_standard_deviation(cpuTotals),
        max_cpu_total_percent: find_maximum(successfulIterations.map(i => i.max_cpu_total_percent)),
        avg_rss_mb: calculate_mean(rssValues),
        std_dev_rss_mb: calculate_standard_deviation(rssValues),
        max_rss_mb: find_maximum(successfulIterations.map(i => i.max_rss_mb)),
        avg_heap_used_mb: calculate_mean(heapUsedValues),
        std_dev_heap_used_mb: calculate_standard_deviation(heapUsedValues),
        max_heap_used_mb: find_maximum(successfulIterations.map(i => i.max_heap_used_mb)),
        avg_heap_utilization_percent: calculate_mean(heapUtilizations),
        std_dev_heap_utilization_percent: calculate_standard_deviation(heapUtilizations),
        avg_duration_seconds: calculate_mean(durations),
        std_dev_duration_seconds: calculate_standard_deviation(durations)
    };
}

function generateSystemMetricsReport(summaries: ClientSystemSummary[]): string {
    let markdown = `# System Resource Usage Analysis\n\n`;
    markdown += `Generated on: ${new Date().toISOString()}\n\n`;
    markdown += `Analysis of CPU and Memory usage patterns across different client configurations.\n\n`;

    // Success Rate Table
    markdown += `## Experiment Success Rates\n\n`;
    markdown += `| Clients | Total Runs | Successful | Failed | Success Rate |\n`;
    markdown += `|---------|------------|------------|--------|---------------|\n`;
    
    summaries.forEach(s => {
        markdown += `| ${s.client} | ${s.total_runs} | ${s.successful_runs} | ${s.failed_runs} | ${s.success_rate.toFixed(1)}% |\n`;
    });

    // CPU Usage Analysis
    markdown += `\n## CPU Usage Analysis (Successful Runs Only)\n\n`;
    markdown += `| Clients | Avg CPU % | StdDev CPU % | Max CPU % | Avg Duration (s) | StdDev Duration (s) |\n`;
    markdown += `|---------|-----------|--------------|-----------|------------------|---------------------|\n`;
    
    summaries.forEach(s => {
        if (s.successful_runs > 0) {
            markdown += `| ${s.client} | ${s.avg_cpu_total_percent.toFixed(1)}% | ${s.std_dev_cpu_total_percent.toFixed(1)}% | ${s.max_cpu_total_percent.toFixed(1)}% | ${s.avg_duration_seconds.toFixed(0)}s | ${s.std_dev_duration_seconds.toFixed(0)}s |\n`;
        }
    });

    // Memory Usage Analysis
    markdown += `\n## Memory Usage Analysis (Successful Runs Only)\n\n`;
    markdown += `| Clients | Avg RSS (MB) | StdDev RSS (MB) | Max RSS (MB) | Avg Heap Used (MB) | Max Heap Used (MB) | Avg Heap Utilization % |\n`;
    markdown += `|---------|--------------|-----------------|--------------|--------------------|--------------------|-------------------------|\n`;
    
    summaries.forEach(s => {
        if (s.successful_runs > 0) {
            markdown += `| ${s.client} | ${s.avg_rss_mb.toFixed(0)} | ${s.std_dev_rss_mb.toFixed(0)} | ${s.max_rss_mb.toFixed(0)} | ${s.avg_heap_used_mb.toFixed(0)} | ${s.max_heap_used_mb.toFixed(0)} | ${s.avg_heap_utilization_percent.toFixed(1)}% |\n`;
        }
    });

    markdown += `\n## Resource Usage Insights\n\n`;

    markdown += `### CPU Usage Trends:\n`;
    summaries.forEach(s => {
        if (s.successful_runs > 0) {
            markdown += `- **${s.client} clients**: ${s.avg_cpu_total_percent.toFixed(1)}% average CPU (max: ${s.max_cpu_total_percent.toFixed(1)}%)\n`;
        }
    });

    markdown += `\n### Memory Usage Trends:\n`;
    summaries.forEach(s => {
        if (s.successful_runs > 0) {
            markdown += `- **${s.client} clients**: ${s.avg_rss_mb.toFixed(0)}MB RSS, ${s.avg_heap_utilization_percent.toFixed(1)}% heap utilization\n`;
        }
    });

    markdown += `\n### Performance Correlations:\n`;
    markdown += `Analyzing the relationship between resource usage and system failures:\n\n`;
    
    for (let i = 1; i < summaries.length; i++) {
        const current = summaries[i];
        const previous = summaries[i-1];
        
        if (current.successful_runs > 0 && previous.successful_runs > 0) {
            const cpuIncrease = ((current.avg_cpu_total_percent - previous.avg_cpu_total_percent) / previous.avg_cpu_total_percent) * 100;
            const memIncrease = ((current.avg_rss_mb - previous.avg_rss_mb) / previous.avg_rss_mb) * 100;
            
            markdown += `- **${previous.client} → ${current.client} clients**: CPU +${cpuIncrease.toFixed(1)}%, Memory +${memIncrease.toFixed(1)}%`;
            
            if (current.failed_runs > previous.failed_runs) {
                markdown += ` ⚠️ Failure rate increased`;
            }
            markdown += `\n`;
        }
    }

    return markdown;
}

function main() {
    console.log('Starting comprehensive system metrics analysis...');
    
    const summaries: ClientSystemSummary[] = [];
    
    for (let clientNum = 1; clientNum <= 10; clientNum++) {
        const summary = analyzeClientSystemMetrics(clientNum);
        summaries.push(summary);
    }
    
    // Generate report
    const report = generateSystemMetricsReport(summaries);
    const reportPath = path.join(__dirname, '../../analysis-results/reports/system-metrics-analysis.md');
    fs.writeFileSync(reportPath, report);
    
    // Generate detailed CSV for all iterations
    let iterationCsv = 'Clients,Iteration,Success,Duration_s,Avg_CPU_Total_%,Max_CPU_Total_%,StdDev_CPU_%,Avg_RSS_MB,Max_RSS_MB,Avg_Heap_Used_MB,Max_Heap_Used_MB,Heap_Utilization_%\n';
    
    for (let clientNum = 1; clientNum <= 10; clientNum++) {
        for (let iter = 1; iter <= 35; iter++) {
            const analysis = analyzeIterationSystemMetrics(clientNum, iter);
            if (analysis) {
                iterationCsv += `${analysis.client},${analysis.iteration},${analysis.success ? 'TRUE' : 'FALSE'},${analysis.duration_seconds.toFixed(0)},${analysis.avg_cpu_total_percent.toFixed(1)},${analysis.max_cpu_total_percent.toFixed(1)},${analysis.std_dev_cpu_total_percent.toFixed(1)},${analysis.avg_rss_mb.toFixed(0)},${analysis.max_rss_mb.toFixed(0)},${analysis.avg_heap_used_mb.toFixed(0)},${analysis.max_heap_used_mb.toFixed(0)},${analysis.heap_utilization_percent.toFixed(1)}\n`;
            }
        }
    }
    
    const iterationCsvPath = path.join(__dirname, '../../analysis-results/csv-data/system-metrics-detailed.csv');
    fs.writeFileSync(iterationCsvPath, iterationCsv);
    
    // Generate summary CSV
    let summaryCsv = 'Clients,Total_Runs,Successful_Runs,Failed_Runs,Success_Rate_%,Avg_CPU_%,StdDev_CPU_%,Max_CPU_%,Avg_RSS_MB,StdDev_RSS_MB,Max_RSS_MB,Avg_Heap_Used_MB,StdDev_Heap_Used_MB,Max_Heap_Used_MB,Avg_Heap_Utilization_%,StdDev_Heap_Utilization_%,Avg_Duration_s,StdDev_Duration_s\n';
    
    summaries.forEach(s => {
        summaryCsv += `${s.client},${s.total_runs},${s.successful_runs},${s.failed_runs},${s.success_rate.toFixed(1)},${s.avg_cpu_total_percent.toFixed(1)},${s.std_dev_cpu_total_percent.toFixed(1)},${s.max_cpu_total_percent.toFixed(1)},${s.avg_rss_mb.toFixed(0)},${s.std_dev_rss_mb.toFixed(0)},${s.max_rss_mb.toFixed(0)},${s.avg_heap_used_mb.toFixed(0)},${s.std_dev_heap_used_mb.toFixed(0)},${s.max_heap_used_mb.toFixed(0)},${s.avg_heap_utilization_percent.toFixed(1)},${s.std_dev_heap_utilization_percent.toFixed(1)},${s.avg_duration_seconds.toFixed(0)},${s.std_dev_duration_seconds.toFixed(0)}\n`;
    });
    
    const summaryCsvPath = path.join(__dirname, '../../analysis-results/csv-data/system-metrics-summary.csv');
    fs.writeFileSync(summaryCsvPath, summaryCsv);

    console.log(`\nSystem metrics analysis saved to:`);
    console.log(`Report: ${reportPath}`);
    console.log(`Detailed CSV: ${iterationCsvPath}`);
    console.log(`Summary CSV: ${summaryCsvPath}`);
    
    console.log('\nResource Usage Summary:');
    summaries.forEach(s => {
        if (s.successful_runs > 0) {
            const perCoreCpu = s.avg_cpu_total_percent / CPU_CORES;
            console.log(`${s.client} clients: ${s.avg_cpu_total_percent.toFixed(1)}% CPU total (${perCoreCpu.toFixed(1)}% per core), ${s.avg_rss_mb.toFixed(0)}MB RAM, ${s.success_rate.toFixed(1)}% success`);
        }
    });
}

main();
