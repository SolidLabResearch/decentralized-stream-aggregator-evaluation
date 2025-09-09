import * as fs from 'fs';
import * as path from 'path';
import { calculate_mean, calculate_standard_deviation, find_maximum, find_minimum, calculate_sum } from '../util/Util';

interface ClientResults {
    client: number;
    iterations: IterationResult[];
    summary: {
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
    };
}

interface IterationResult {
    iteration: number;
    pre_preprocess_array: number[];
    add_event_to_rsp_engine_array: number[];
    received_aggregation_event_array: number[];
    time_to_fetch_event_array: number[];
    time_to_subscribe_array: number[];
    add_event_mean: number;
    add_event_sd: number;
    fetch_event_mean: number;
    fetch_event_sd: number;
    fetch_event_sum: number;
    preprocess_mean: number;
    preprocess_sd: number;
    preprocess_sum: number;
    first_event_latency: number;
}

const BASE_LOCATION = "/Users/kushbisen/Downloads/WithoutAggregatorApproach";

function calculateFirstEventLatency(iterationDir: string): number {
    const csparlWindowLogPath = path.join(iterationDir, 'CSPARQLWindow.log');
    const resultCsvPath = path.join(iterationDir, 'result-0-client.csv');
    
    try {
        // Get first event addition timestamp from CSPARQLWindow.log
        const windowLog = fs.readFileSync(csparlWindowLogPath, 'utf-8');
        const windowLines = windowLog.split('\n');
        const firstEventLine = windowLines.find(line => line.includes('adding_event_to_the_window'));
        const firstEventTimestamp = firstEventLine?.split(',')[0];
        
        if (!firstEventTimestamp) {
            console.warn(`No first event addition timestamp found in ${csparlWindowLogPath}`);
            return 0;
        }
        
        // Get first result timestamp from result-0-client.csv
        const resultCsv = fs.readFileSync(resultCsvPath, 'utf-8');
        const resultLines = resultCsv.split('\n');
        const firstResultLine = resultLines.find(line => line.trim() && /^\d+,/.test(line));
        const firstResultTimestamp = firstResultLine?.split(',')[0];
        
        if (!firstResultTimestamp) {
            console.warn(`No first result timestamp found in ${resultCsvPath}`);
            return 0;
        }
        
        // Calculate latency in milliseconds
        const latency = parseInt(firstResultTimestamp) - parseInt(firstEventTimestamp);
        return Math.max(0, latency); // Ensure non-negative
        
    } catch (error) {
        console.warn(`Error calculating first event latency for ${iterationDir}:`, error);
        return 0;
    }
}

function processCSVFile(filePath: string): IterationResult {
    const file = fs.readFileSync(filePath, 'utf-8');
    const lines = file.split('\n');
    
    const pre_preprocess_array: number[] = [];
    const add_event_to_rsp_engine_array: number[] = [];
    const received_aggregation_event_array: number[] = [];
    const time_to_fetch_event_array: number[] = [];
    const time_to_subscribe_array: number[] = [];

    lines.forEach((line) => {
        const [key, value] = line.trim().split(',');

        if (line === '') {
            return;
        }

        if (key === 'time_to_find_ldes_stream') {
            // console.log(`The time to find LDES stream is ${value}.`);
        }
        else if (key === 'time_to_subscribe') {
            time_to_subscribe_array.push(Number(value));
        }
        else if (key === 'time_to_fetch_notification') {
            time_to_fetch_event_array.push(Number(value));
        }   
        else if (key === 'time_to_preprocess_event') {
            pre_preprocess_array.push(Number(value));
        }
        else if (key === 'time_to_add_event_to_rsp_engine') {
            add_event_to_rsp_engine_array.push(Number(value));
        }
        else if (key === 'time_received_aggregation_event') {
            received_aggregation_event_array.push(Number(value));
        }
    });

    const add_event_mean = calculate_mean(add_event_to_rsp_engine_array);
    const add_event_sd = calculate_standard_deviation(add_event_to_rsp_engine_array);
    const fetch_event_mean = calculate_mean(time_to_fetch_event_array);
    const fetch_event_sd = calculate_standard_deviation(time_to_fetch_event_array);
    const fetch_event_sum = calculate_sum(time_to_fetch_event_array);
    const preprocess_mean = calculate_mean(pre_preprocess_array);
    const preprocess_sd = calculate_standard_deviation(pre_preprocess_array);
    const preprocess_sum = calculate_sum(pre_preprocess_array);

    return {
        iteration: 0, // Will be set by caller
        pre_preprocess_array,
        add_event_to_rsp_engine_array,
        received_aggregation_event_array,
        time_to_fetch_event_array,
        time_to_subscribe_array,
        add_event_mean,
        add_event_sd,
        fetch_event_mean,
        fetch_event_sd,
        fetch_event_sum,
        preprocess_mean,
        preprocess_sd,
        preprocess_sum,
        first_event_latency: 0 // Will be set by caller
    };
}

function processClientData(clientNumber: number): ClientResults {
    const clientDir = path.join(BASE_LOCATION, `${clientNumber}clients`);
    const iterations: IterationResult[] = [];
    
    // Collect all values across all iterations for overall summary
    const allAddEventValues: number[] = [];
    const allFetchEventValues: number[] = [];
    const allPreprocessValues: number[] = [];
    const allFirstEventLatencies: number[] = [];

    // Process each iteration (1 to 35)
    for (let i = 1; i <= 35; i++) {
        const iterationDir = path.join(clientDir, i.toString());
        const csvFile = path.join(iterationDir, `without-aggregator-0-client.csv`);
        
        if (fs.existsSync(csvFile)) {
            const result = processCSVFile(csvFile);
            result.iteration = i;
            
            // Calculate first event latency for this iteration
            result.first_event_latency = calculateFirstEventLatency(iterationDir);
            
            iterations.push(result);
            
            // Collect values for overall summary
            allAddEventValues.push(...result.add_event_to_rsp_engine_array);
            allFetchEventValues.push(...result.time_to_fetch_event_array);
            allPreprocessValues.push(...result.pre_preprocess_array);
            allFirstEventLatencies.push(result.first_event_latency);
        } else {
            console.warn(`CSV file not found: ${csvFile}`);
        }
    }

    // Calculate overall summary across all iterations
    const summary = {
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

    return {
        client: clientNumber,
        iterations,
        summary
    };
}

function generateMarkdownReport(allResults: ClientResults[]): string {
    let markdown = `# Without Aggregator Approach - Analysis Report (with First Event Latency)\n\n`;
    markdown += `Generated on: ${new Date().toISOString()}\n\n`;

    // Summary Table
    markdown += `## Summary Table\n\n`;
    markdown += `| Client | Add Event Mean | Add Event SD | Fetch Event Mean | Fetch Event SD | Fetch Event Sum | Preprocess Mean | Preprocess SD | Preprocess Sum | First Event Latency Mean | First Event Latency SD |\n`;
    markdown += `|--------|----------------|--------------|------------------|----------------|------------------|-----------------|---------------|----------------|--------------------------|------------------------|\n`;

    allResults.forEach(result => {
        markdown += `| ${result.client} clients | ${result.summary.add_event_mean.toFixed(2)} | ${result.summary.add_event_sd.toFixed(2)} | ${result.summary.fetch_event_mean.toFixed(2)} | ${result.summary.fetch_event_sd.toFixed(2)} | ${result.summary.fetch_event_sum.toFixed(2)} | ${result.summary.preprocess_mean.toFixed(2)} | ${result.summary.preprocess_sd.toFixed(2)} | ${result.summary.preprocess_sum.toFixed(2)} | ${result.summary.first_event_latency_mean.toFixed(2)} | ${result.summary.first_event_latency_sd.toFixed(2)} |\n`;
    });

    // Detailed per-iteration tables
    markdown += `\n## Detailed Per-Iteration Results\n\n`;

    allResults.forEach(clientResult => {
        markdown += `### ${clientResult.client} clients\n\n`;
        markdown += `| Iteration | Add Event Mean | Add Event SD | Fetch Event Mean | Fetch Event SD | Fetch Event Sum | Preprocess Mean | Preprocess SD | Preprocess Sum | First Event Latency (ms) |\n`;
        markdown += `|-----------|----------------|--------------|------------------|----------------|------------------|-----------------|---------------|----------------|-------------------------|\n`;

        clientResult.iterations.forEach(iter => {
            markdown += `| ${iter.iteration} | ${iter.add_event_mean.toFixed(2)} | ${iter.add_event_sd.toFixed(2)} | ${iter.fetch_event_mean.toFixed(2)} | ${iter.fetch_event_sd.toFixed(2)} | ${iter.fetch_event_sum.toFixed(2)} | ${iter.preprocess_mean.toFixed(2)} | ${iter.preprocess_sd.toFixed(2)} | ${iter.preprocess_sum.toFixed(2)} | ${iter.first_event_latency.toFixed(2)} |\n`;
        });

        markdown += `\n**Summary for ${clientResult.client} clients:**\n`;
        markdown += `- Add Event Mean (overall): ${clientResult.summary.add_event_mean.toFixed(2)}\n`;
        markdown += `- Add Event SD (overall): ${clientResult.summary.add_event_sd.toFixed(2)}\n`;
        markdown += `- Fetch Event Mean (overall): ${clientResult.summary.fetch_event_mean.toFixed(2)}\n`;
        markdown += `- Fetch Event SD (overall): ${clientResult.summary.fetch_event_sd.toFixed(2)}\n`;
        markdown += `- Fetch Event Sum (overall): ${clientResult.summary.fetch_event_sum.toFixed(2)}\n`;
        markdown += `- Preprocess Mean (overall): ${clientResult.summary.preprocess_mean.toFixed(2)}\n`;
        markdown += `- Preprocess SD (overall): ${clientResult.summary.preprocess_sd.toFixed(2)}\n`;
        markdown += `- Preprocess Sum (overall): ${clientResult.summary.preprocess_sum.toFixed(2)}\n`;
        markdown += `- First Event Latency Mean (overall): ${clientResult.summary.first_event_latency_mean.toFixed(2)} ms\n`;
        markdown += `- First Event Latency SD (overall): ${clientResult.summary.first_event_latency_sd.toFixed(2)} ms\n\n`;
    });

    return markdown;
}

function main() {
    console.log('Starting analysis of Without Aggregator Approach data with First Event Latency...');
    
    const allResults: ClientResults[] = [];

    // Process data for clients 1-10
    for (let clientNum = 1; clientNum <= 10; clientNum++) {
        console.log(`Processing client ${clientNum}...`);
        const clientResult = processClientData(clientNum);
        allResults.push(clientResult);
        console.log(`Completed client ${clientNum} with ${clientResult.iterations.length} iterations`);
    }

    // Generate markdown report
    const markdownReport = generateMarkdownReport(allResults);

    // Write to file
    const outputPath = path.join(__dirname, '../../without-aggregator-analysis-with-latency-report.md');
    fs.writeFileSync(outputPath, markdownReport);

    console.log(`Analysis complete! Report saved to: ${outputPath}`);
    console.log('\nSummary:');
    allResults.forEach(result => {
        console.log(`${result.client} clients: ${result.iterations.length} iterations processed, avg first event latency: ${result.summary.first_event_latency_mean.toFixed(2)}ms`);
    });
}

// Run the analysis
main();
