#!/usr/bin/env node

/**
 * Enhanced Analysis Script with RSP Query Processing Time
 * 
 * This script extends the existing analysis to include RSP Engine query processing time
 * by parsing RSP Engine logs and calculating the time between "Starting Window Query Processing"
 * and "Ended the execution of the R2R Operator" events.
 */

const fs = require('fs');
const path = require('path');

const BASE_LOCATION = "/Users/kushbisen/Downloads/WithoutAggregatorApproach";

/**
 * Utility functions for statistical calculations
 */
function calculate_mean(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculate_standard_deviation(values) {
    if (!values || values.length === 0) return 0;
    const mean = calculate_mean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = calculate_mean(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
}

/**
 * Parse RSP Engine log to extract query processing times
 */
function parseRSPEngineLog(logFilePath) {
    if (!fs.existsSync(logFilePath)) {
        return [];
    }

    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    const processingTimes = [];
    let startTime = null;
    
    for (const line of lines) {
        if (line.includes('Starting Window Query Processing')) {
            // Extract timestamp from the beginning of the line
            const timestamp = parseInt(line.split(',')[0]);
            startTime = timestamp;
        } else if (line.includes('Ended the execution of the R2R Operator') && startTime !== null) {
            // Extract timestamp and calculate processing time
            const timestamp = parseInt(line.split(',')[0]);
            const processingTime = timestamp - startTime;
            processingTimes.push(processingTime);
            startTime = null; // Reset for next window
        }
    }
    
    return processingTimes;
}

/**
 * Parse the main CSV file to extract existing metrics
 * CSV format: metric_name,value (one pair per line)
 */
function parseMainCSV(csvFilePath) {
    if (!fs.existsSync(csvFilePath)) {
        return null;
    }

    const csvContent = fs.readFileSync(csvFilePath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Initialize metric arrays
    const fetchTimes = [];
    const addTimes = [];
    const preprocessTimes = [];
    
    // Parse each line
    for (const line of lines) {
        const [metric, valueStr] = line.split(',');
        const value = parseFloat(valueStr);
        
        if (isNaN(value)) continue;
        
        if (metric === 'time_to_fetch_notification') {
            fetchTimes.push(value);
        } else if (metric === 'time_to_add_event_to_rsp_engine') {
            addTimes.push(value);
        } else if (metric === 'time_to_preprocess_event') {
            preprocessTimes.push(value);
        }
    }
    
    // Calculate statistics
    return {
        addEventMean: calculate_mean(addTimes),
        addEventSD: calculate_standard_deviation(addTimes),
        fetchEventMean: calculate_mean(fetchTimes),
        fetchEventSD: calculate_standard_deviation(fetchTimes),
        fetchEventSum: fetchTimes.reduce((sum, val) => sum + val, 0),
        preprocessMean: calculate_mean(preprocessTimes),
        preprocessSD: calculate_standard_deviation(preprocessTimes),
        preprocessSum: preprocessTimes.reduce((sum, val) => sum + val, 0),
        // We'll get first event latency from our previous analysis
        firstEventLatency: 0 // Will be filled from the existing detailed CSV
    };
}

/**
 * Load first event latency data from our previous analysis
 */
function loadFirstEventLatencyData() {
    const latencyFilePath = path.join(__dirname, '../../analysis-results/csv-data/without-aggregator-detailed-with-latency-results.csv');
    
    if (!fs.existsSync(latencyFilePath)) {
        return {};
    }
    
    const csvContent = fs.readFileSync(latencyFilePath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return {};
    
    const headers = lines[0].split(',').map(h => h.trim());
    const clientIdx = headers.indexOf('Clients');
    const iterationIdx = headers.indexOf('Iteration');
    const latencyIdx = headers.indexOf('First_Event_Latency_ms');
    
    const latencyData = {};
    
    for (let i = 1; i < lines.length; i++) {
        const data = lines[i].split(',').map(d => d.trim());
        const clients = parseInt(data[clientIdx]);
        const iteration = parseInt(data[iterationIdx]);
        const latency = parseFloat(data[latencyIdx]);
        
        const key = `${clients}-${iteration}`;
        latencyData[key] = latency;
    }
    
    return latencyData;
}

/**
 * Analyze a single iteration for all metrics including RSP processing time
 */
function analyzeIteration(clientNum, iteration, latencyData) {
    const iterationDir = path.join(BASE_LOCATION, `${clientNum}clients`, iteration.toString());
    const rspLogFile = path.join(iterationDir, 'RSPEngine.log');
    const csvFile = path.join(iterationDir, 'without-aggregator-0-client.csv');
    
    // Parse RSP Engine processing times
    const processingTimes = parseRSPEngineLog(rspLogFile);
    
    // Parse existing metrics
    const existingMetrics = parseMainCSV(csvFile);
    
    if (!existingMetrics || processingTimes.length === 0) {
        return null;
    }
    
    // Get first event latency from our previous analysis
    const latencyKey = `${clientNum}-${iteration}`;
    const firstEventLatency = latencyData[latencyKey] || 0;
    
    // Calculate RSP processing statistics
    const rspProcessingMean = calculate_mean(processingTimes);
    const rspProcessingSD = calculate_standard_deviation(processingTimes);
    const rspProcessingSum = processingTimes.reduce((sum, time) => sum + time, 0);
    const rspProcessingMin = Math.min(...processingTimes);
    const rspProcessingMax = Math.max(...processingTimes);
    const rspProcessingCount = processingTimes.length;
    
    return {
        clients: clientNum,
        iteration: iteration,
        // Existing metrics
        addEventMean: existingMetrics.addEventMean,
        addEventSD: existingMetrics.addEventSD,
        fetchEventMean: existingMetrics.fetchEventMean,
        fetchEventSD: existingMetrics.fetchEventSD,
        fetchEventSum: existingMetrics.fetchEventSum,
        preprocessMean: existingMetrics.preprocessMean,
        preprocessSD: existingMetrics.preprocessSD,
        preprocessSum: existingMetrics.preprocessSum,
        firstEventLatency: firstEventLatency,
        // New RSP processing metrics
        rspProcessingMean: rspProcessingMean,
        rspProcessingSD: rspProcessingSD,
        rspProcessingSum: rspProcessingSum,
        rspProcessingMin: rspProcessingMin,
        rspProcessingMax: rspProcessingMax,
        rspProcessingCount: rspProcessingCount
    };
}

/**
 * Analyze all client configurations
 */
function analyzeAllConfigurations() {
    const results = [];
    
    // Load first event latency data
    console.log('Loading first event latency data...');
    const latencyData = loadFirstEventLatencyData();
    console.log(`Loaded latency data for ${Object.keys(latencyData).length} configurations`);
    
    console.log('Analyzing RSP Engine query processing times...');
    
    for (let clientNum = 1; clientNum <= 10; clientNum++) {
        console.log(`Processing ${clientNum} clients...`);
        
        for (let iteration = 1; iteration <= 35; iteration++) {
            const analysis = analyzeIteration(clientNum, iteration, latencyData);
            if (analysis) {
                results.push(analysis);
            }
        }
    }
    
    return results;
}

/**
 * Generate CSV output with all metrics
 */
function generateEnhancedCSV(results) {
    const headers = [
        'Clients', 'Iteration',
        'Add_Event_Mean', 'Add_Event_SD', 
        'Fetch_Event_Mean', 'Fetch_Event_SD', 'Fetch_Event_Sum',
        'Preprocess_Mean', 'Preprocess_SD', 'Preprocess_Sum',
        'First_Event_Latency_ms',
        'RSP_Processing_Mean_ms', 'RSP_Processing_SD_ms', 'RSP_Processing_Sum_ms',
        'RSP_Processing_Min_ms', 'RSP_Processing_Max_ms', 'RSP_Processing_Count'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    for (const result of results) {
        const row = [
            result.clients, result.iteration,
            result.addEventMean.toFixed(2), result.addEventSD.toFixed(2),
            result.fetchEventMean.toFixed(2), result.fetchEventSD.toFixed(2), result.fetchEventSum.toFixed(2),
            result.preprocessMean.toFixed(2), result.preprocessSD.toFixed(2), result.preprocessSum.toFixed(2),
            result.firstEventLatency.toFixed(2),
            result.rspProcessingMean.toFixed(2), result.rspProcessingSD.toFixed(2), result.rspProcessingSum.toFixed(2),
            result.rspProcessingMin.toFixed(2), result.rspProcessingMax.toFixed(2), result.rspProcessingCount
        ];
        csvContent += row.join(',') + '\n';
    }
    
    return csvContent;
}

/**
 * Generate summary statistics for RSP processing times
 */
function generateRSPProcessingSummary(results) {
    const summaryByClients = {};
    
    // Group by client count
    for (const result of results) {
        if (!summaryByClients[result.clients]) {
            summaryByClients[result.clients] = [];
        }
        summaryByClients[result.clients].push(result);
    }
    
    const summary = [];
    
    for (const [clientCount, iterations] of Object.entries(summaryByClients)) {
        const rspMeans = iterations.map(i => i.rspProcessingMean);
        const rspCounts = iterations.map(i => i.rspProcessingCount);
        const totalWindows = rspCounts.reduce((sum, count) => sum + count, 0);
        
        summary.push({
            clients: parseInt(clientCount),
            avgRSPProcessingTime: calculate_mean(rspMeans),
            stdRSPProcessingTime: calculate_standard_deviation(rspMeans),
            minRSPProcessingTime: Math.min(...rspMeans),
            maxRSPProcessingTime: Math.max(...rspMeans),
            totalWindowsProcessed: totalWindows,
            avgWindowsPerIteration: calculate_mean(rspCounts),
            successfulIterations: iterations.length
        });
    }
    
    return summary;
}

/**
 * Print RSP processing time analysis
 */
function printRSPAnalysis(summary) {
    console.log('\n' + '='.repeat(100));
    console.log('RSP ENGINE QUERY PROCESSING TIME ANALYSIS');
    console.log('='.repeat(100));
    
    console.log('Clients  Avg Time (ms)   Std Dev (ms)  Min (ms)   Max (ms)   Total Windows Avg Windows/Run');
    console.log('-'.repeat(100));
    
    for (const stat of summary) {
        console.log(`${stat.clients.toString().padEnd(8)} ${stat.avgRSPProcessingTime.toFixed(2).padEnd(15)} ${stat.stdRSPProcessingTime.toFixed(2).padEnd(13)} ${stat.minRSPProcessingTime.toFixed(2).padEnd(10)} ${stat.maxRSPProcessingTime.toFixed(2).padEnd(10)} ${stat.totalWindowsProcessed.toString().padEnd(13)} ${stat.avgWindowsPerIteration.toFixed(1).padEnd(15)}`);
    }
    
    // Performance degradation analysis
    console.log('\n' + '='.repeat(70));
    console.log('RSP PROCESSING TIME DEGRADATION ANALYSIS');
    console.log('='.repeat(70));
    
    const baseline = summary[0];
    
    console.log('Clients  Avg Time (ms)   vs 1-client  Degradation');
    console.log('-'.repeat(70));
    
    for (const stat of summary) {
        const degradationFactor = stat.avgRSPProcessingTime / baseline.avgRSPProcessingTime;
        const degradationPercent = (degradationFactor - 1) * 100;
        
        const degradationStr = degradationPercent > 0 ? `+${degradationPercent.toFixed(1)}%` : `${degradationPercent.toFixed(1)}%`;
        
        console.log(`${stat.clients.toString().padEnd(8)} ${stat.avgRSPProcessingTime.toFixed(2).padEnd(15)} ${degradationFactor.toFixed(2).padEnd(12)}x ${degradationStr.padEnd(12)}`);
    }
}

/**
 * Main function
 */
function main() {
    try {
        console.log('Starting enhanced analysis with RSP Engine query processing times...');
        
        // Analyze all configurations
        const results = analyzeAllConfigurations();
        
        if (results.length === 0) {
            console.error('No valid data found!');
            return 1;
        }
        
        // Generate enhanced CSV
        const csvContent = generateEnhancedCSV(results);
        const csvPath = path.join(__dirname, '../../analysis-results/csv-data/enhanced-analysis-with-rsp-processing.csv');
        
        // Ensure directory exists
        const csvDir = path.dirname(csvPath);
        if (!fs.existsSync(csvDir)) {
            fs.mkdirSync(csvDir, { recursive: true });
        }
        
        fs.writeFileSync(csvPath, csvContent);
        console.log(`Enhanced CSV with RSP processing times saved to: ${csvPath}`);
        
        // Generate and print summary
        const summary = generateRSPProcessingSummary(results);
        printRSPAnalysis(summary);
        
        // Save summary CSV
        const summaryHeaders = [
            'Clients', 'Avg_RSP_Processing_Time_ms', 'Std_RSP_Processing_Time_ms',
            'Min_RSP_Processing_Time_ms', 'Max_RSP_Processing_Time_ms',
            'Total_Windows_Processed', 'Avg_Windows_Per_Iteration', 'Successful_Iterations'
        ];
        
        let summaryCsvContent = summaryHeaders.join(',') + '\n';
        for (const stat of summary) {
            const row = [
                stat.clients, 
                stat.avgRSPProcessingTime.toFixed(2), 
                stat.stdRSPProcessingTime.toFixed(2),
                stat.minRSPProcessingTime.toFixed(2), 
                stat.maxRSPProcessingTime.toFixed(2),
                stat.totalWindowsProcessed, 
                stat.avgWindowsPerIteration.toFixed(1), 
                stat.successfulIterations
            ];
            summaryCsvContent += row.join(',') + '\n';
        }
        
        const summaryCsvPath = path.join(__dirname, '../../analysis-results/csv-data/rsp-processing-summary.csv');
        fs.writeFileSync(summaryCsvPath, summaryCsvContent);
        console.log(`RSP processing summary saved to: ${summaryCsvPath}`);
        
        console.log(`\nAnalysis complete! Found ${results.length} valid iterations.`);
        
    } catch (error) {
        console.error('Error during analysis:', error);
        return 1;
    }
    
    return 0;
}

if (require.main === module) {
    process.exit(main());
}

module.exports = {
    analyzeIteration,
    analyzeAllConfigurations,
    parseRSPEngineLog
};
