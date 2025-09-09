import * as fs from 'fs';
import * as path from 'path';
import { calculate_mean, calculate_standard_deviation, calculate_sum } from '../util/Util';

const BASE_LOCATION = "/Users/kushbisen/Downloads/WithoutAggregatorApproach";

interface SummaryRow {
    client: number;
    successfulRuns: number;
    totalRuns: number;
    successRate: number;
    add_event_mean: number;
    add_event_sd: number;
    fetch_event_mean: number;
    fetch_event_sd: number;
    fetch_event_sum: number;
    preprocess_mean: number;
    preprocess_sd: number;
    preprocess_sum: number;
    first_event_latency_mean: number;
    first_event_latency_sd: number;
}

function calculateFirstEventLatency(iterationDir: string): number {
    const csparlWindowLogPath = path.join(iterationDir, 'CSPARQLWindow.log');
    const resultCsvPath = path.join(iterationDir, 'result-0-client.csv');
    
    try {
        if (!fs.existsSync(resultCsvPath) || !fs.existsSync(csparlWindowLogPath)) {
            return -1; // Failed experiment
        }
        
        // Get first event addition timestamp
        const windowLog = fs.readFileSync(csparlWindowLogPath, 'utf-8');
        const windowLines = windowLog.split('\n');
        const firstEventLine = windowLines.find(line => line.includes('adding_event_to_the_window'));
        const firstEventTimestamp = firstEventLine?.split(',')[0];
        
        if (!firstEventTimestamp) return -1;
        
        // Get first result timestamp
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

function processClientData(clientNum: number): SummaryRow {
    const clientDir = path.join(BASE_LOCATION, `${clientNum}clients`);
    
    const allAddEventValues: number[] = [];
    const allFetchEventValues: number[] = [];
    const allPreprocessValues: number[] = [];
    const allFirstEventLatencies: number[] = [];
    
    let successfulRuns = 0;
    const totalRuns = 35;
    
    console.log(`Processing ${clientNum} clients...`);
    
    for (let i = 1; i <= totalRuns; i++) {
        const iterationDir = path.join(clientDir, i.toString());
        const csvFile = path.join(iterationDir, 'result-0-client.csv');
        
        // Check if this iteration was successful
        if (!fs.existsSync(csvFile)) {
            continue; // Skip failed iterations
        }
        
        successfulRuns++;
        
        // Calculate first event latency
        const firstEventLatency = calculateFirstEventLatency(iterationDir);
        if (firstEventLatency >= 0) {
            allFirstEventLatencies.push(firstEventLatency);
        }
        
        // Process CSV metrics
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
    
    return {
        client: clientNum,
        successfulRuns,
        totalRuns,
        successRate: (successfulRuns / totalRuns) * 100,
        add_event_mean: calculate_mean(allAddEventValues),
        add_event_sd: calculate_standard_deviation(allAddEventValues),
        fetch_event_mean: calculate_mean(allFetchEventValues),
        fetch_event_sd: calculate_standard_deviation(allFetchEventValues),
        fetch_event_sum: calculate_sum(allFetchEventValues),
        preprocess_mean: calculate_mean(allPreprocessValues),
        preprocess_sd: calculate_standard_deviation(allPreprocessValues),
        preprocess_sum: calculate_sum(allPreprocessValues),
        first_event_latency_mean: calculate_mean(allFirstEventLatencies),
        first_event_latency_sd: calculate_standard_deviation(allFirstEventLatencies)
    };
}

function main() {
    console.log('Starting fast analysis of Without Aggregator Approach data...');
    
    const summaryRows: SummaryRow[] = [];
    
    // Process each client configuration
    for (let clientNum = 1; clientNum <= 10; clientNum++) {
        const summary = processClientData(clientNum);
        summaryRows.push(summary);
        console.log(`Completed ${clientNum} clients: ${summary.successfulRuns}/${summary.totalRuns} successful (${summary.successRate.toFixed(1)}%)`);
    }
    
    // Write summary CSV
    let summaryContent = 'Clients,Successful_Runs,Total_Runs,Success_Rate_Percent,Add_Event_Mean,Add_Event_SD,Fetch_Event_Mean,Fetch_Event_SD,Fetch_Event_Sum,Preprocess_Mean,Preprocess_SD,Preprocess_Sum,First_Event_Latency_Mean_ms,First_Event_Latency_SD_ms\n';
    summaryRows.forEach(row => {
        summaryContent += `${row.client},${row.successfulRuns},${row.totalRuns},${row.successRate.toFixed(1)},${row.add_event_mean.toFixed(2)},${row.add_event_sd.toFixed(2)},${row.fetch_event_mean.toFixed(2)},${row.fetch_event_sd.toFixed(2)},${row.fetch_event_sum.toFixed(2)},${row.preprocess_mean.toFixed(2)},${row.preprocess_sd.toFixed(2)},${row.preprocess_sum.toFixed(2)},${row.first_event_latency_mean.toFixed(2)},${row.first_event_latency_sd.toFixed(2)}\n`;
    });
    
    const summaryOutputPath = path.join(__dirname, '../../without-aggregator-final-summary.csv');
    fs.writeFileSync(summaryOutputPath, summaryContent);
    
    console.log(`\nFinal summary CSV saved to: ${summaryOutputPath}`);
    console.log('\nSummary:');
    summaryRows.forEach(row => {
        console.log(`${row.client} clients: ${row.successfulRuns}/${row.totalRuns} runs (${row.successRate.toFixed(1)}%), Avg Latency: ${row.first_event_latency_mean.toFixed(0)}ms`);
    });
}

main();
