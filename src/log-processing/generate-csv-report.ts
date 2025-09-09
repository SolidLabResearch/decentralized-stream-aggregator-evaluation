import * as fs from 'fs';
import * as path from 'path';
import { calculate_mean, calculate_standard_deviation, find_maximum, find_minimum, calculate_sum } from '../util/Util';

const BASE_LOCATION = "/Users/kushbisen/Downloads/WithoutAggregatorApproach";

interface CSVRow {
    client: number;
    iteration: number;
    add_event_mean: number;
    add_event_sd: number;
    fetch_event_mean: number;
    fetch_event_sd: number;
    fetch_event_sum: number;
    preprocess_mean: number;
    preprocess_sd: number;
    preprocess_sum: number;
}

function processCSVFile(filePath: string): { add_event_mean: number, add_event_sd: number, fetch_event_mean: number, fetch_event_sd: number, fetch_event_sum: number, preprocess_mean: number, preprocess_sd: number, preprocess_sum: number } {
    const file = fs.readFileSync(filePath, 'utf-8');
    const lines = file.split('\n');
    
    const add_event_to_rsp_engine_array: number[] = [];
    const time_to_fetch_event_array: number[] = [];
    const pre_preprocess_array: number[] = [];

    lines.forEach((line) => {
        const [key, value] = line.trim().split(',');

        if (line === '' || !value) {
            return;
        }

        if (key === 'time_to_fetch_notification') {
            time_to_fetch_event_array.push(Number(value));
        }   
        else if (key === 'time_to_add_event_to_rsp_engine') {
            add_event_to_rsp_engine_array.push(Number(value));
        }
        else if (key === 'time_to_preprocess_event') {
            pre_preprocess_array.push(Number(value));
        }
    });

    return {
        add_event_mean: calculate_mean(add_event_to_rsp_engine_array),
        add_event_sd: calculate_standard_deviation(add_event_to_rsp_engine_array),
        fetch_event_mean: calculate_mean(time_to_fetch_event_array),
        fetch_event_sd: calculate_standard_deviation(time_to_fetch_event_array),
        fetch_event_sum: calculate_sum(time_to_fetch_event_array),
        preprocess_mean: calculate_mean(pre_preprocess_array),
        preprocess_sd: calculate_standard_deviation(pre_preprocess_array),
        preprocess_sum: calculate_sum(pre_preprocess_array)
    };
}

function generateCSVReport(): void {
    console.log('Generating CSV report...');
    
    const csvRows: CSVRow[] = [];
    const summaryRows: Array<{client: number, add_event_mean: number, add_event_sd: number, fetch_event_mean: number, fetch_event_sd: number, fetch_event_sum: number, preprocess_mean: number, preprocess_sd: number, preprocess_sum: number}> = [];

    // Process data for clients 1-10
    for (let clientNum = 1; clientNum <= 10; clientNum++) {
        console.log(`Processing client ${clientNum}...`);
        const clientDir = path.join(BASE_LOCATION, `${clientNum}clients`);
        
        const allAddEventValues: number[] = [];
        const allFetchEventValues: number[] = [];
        const allPreprocessValues: number[] = [];

        // Process each iteration (1 to 35)
        for (let i = 1; i <= 35; i++) {
            const iterationDir = path.join(clientDir, i.toString());
            const csvFile = path.join(iterationDir, `without-aggregator-0-client.csv`);
            
            if (fs.existsSync(csvFile)) {
                const result = processCSVFile(csvFile);
                
                csvRows.push({
                    client: clientNum,
                    iteration: i,
                    add_event_mean: result.add_event_mean,
                    add_event_sd: result.add_event_sd,
                    fetch_event_mean: result.fetch_event_mean,
                    fetch_event_sd: result.fetch_event_sd,
                    fetch_event_sum: result.fetch_event_sum,
                    preprocess_mean: result.preprocess_mean,
                    preprocess_sd: result.preprocess_sd,
                    preprocess_sum: result.preprocess_sum
                });

                // Read the file again to get all individual values for summary
                const file = fs.readFileSync(csvFile, 'utf-8');
                const lines = file.split('
');
                
                lines.forEach((line) => {
                    const [key, value] = line.trim().split(',');
                    if (line === '' || !value) return;
                    
                    if (key === 'time_to_fetch_notification') {
                        allFetchEventValues.push(Number(value));
                    } else if (key === 'time_to_add_event_to_rsp_engine') {
                        allAddEventValues.push(Number(value));
                    } else if (key === 'time_to_preprocess_event') {
                        allPreprocessValues.push(Number(value));
                    }
                });
            }
        }

        // Add summary for this client
        summaryRows.push({
            client: clientNum,
            add_event_mean: calculate_mean(allAddEventValues),
            add_event_sd: calculate_standard_deviation(allAddEventValues),
            fetch_event_mean: calculate_mean(allFetchEventValues),
            fetch_event_sd: calculate_standard_deviation(allFetchEventValues),
            fetch_event_sum: calculate_sum(allFetchEventValues),
            preprocess_mean: calculate_mean(allPreprocessValues),
            preprocess_sd: calculate_standard_deviation(allPreprocessValues),
            preprocess_sum: calculate_sum(allPreprocessValues)
        });
    }

    // Write detailed CSV
    let csvContent = 'Client,Iteration,Add_Event_Mean,Add_Event_SD,Fetch_Event_Mean,Fetch_Event_SD,Fetch_Event_Sum,Preprocess_Mean,Preprocess_SD,Preprocess_Sum\n';
    csvRows.forEach(row => {
        csvContent += `${row.client},${row.iteration},${row.add_event_mean.toFixed(2)},${row.add_event_sd.toFixed(2)},${row.fetch_event_mean.toFixed(2)},${row.fetch_event_sd.toFixed(2)},${row.fetch_event_sum.toFixed(2)},${row.preprocess_mean.toFixed(2)},${row.preprocess_sd.toFixed(2)},${row.preprocess_sum.toFixed(2)}\n`;
    });

    const detailedOutputPath = path.join(__dirname, '../../without-aggregator-detailed-results.csv');
    fs.writeFileSync(detailedOutputPath, csvContent);

    // Write summary CSV
    let summaryContent = 'Client,Add_Event_Mean_Overall,Add_Event_SD_Overall,Fetch_Event_Mean_Overall,Fetch_Event_SD_Overall,Fetch_Event_Sum_Overall,Preprocess_Mean_Overall,Preprocess_SD_Overall,Preprocess_Sum_Overall\n';
    summaryRows.forEach(row => {
        summaryContent += `${row.client},${row.add_event_mean.toFixed(2)},${row.add_event_sd.toFixed(2)},${row.fetch_event_mean.toFixed(2)},${row.fetch_event_sd.toFixed(2)},${row.fetch_event_sum.toFixed(2)},${row.preprocess_mean.toFixed(2)},${row.preprocess_sd.toFixed(2)},${row.preprocess_sum.toFixed(2)}\n`;
    });

    const summaryOutputPath = path.join(__dirname, '../../without-aggregator-summary-results.csv');
    fs.writeFileSync(summaryOutputPath, summaryContent);

    console.log(`Detailed CSV saved to: ${detailedOutputPath}`);
    console.log(`Summary CSV saved to: ${summaryOutputPath}`);
}

// Run the CSV generation
generateCSVReport();
