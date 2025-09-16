import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const baseDownloadsPath = "/Users/kushbisen/Downloads/1client";

interface LogEntry {
    msg: string;
    time: string;
}

async function processLogFile(logFilePath: string): Promise<{
    isomorphicCheck: number | null;
    queryPreprocessing: number | null;
    eventPreprocessing: number[];
    addingToRSPEngine: number[];
}> {
    return new Promise((resolve) => {
        const logs: LogEntry[] = [];
        const lineReader = readline.createInterface({
            input: fs.createReadStream(logFilePath),
        });

        lineReader.on('line', (line: string) => {
            try {
                const logEntry: LogEntry = JSON.parse(line);
                logs.push(logEntry);
            } catch (e) {
                // Skip invalid JSON lines
            }
        });

        lineReader.on('close', () => {
            logs.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
            
            // Query Isomorphic Check (from query_preprocessed to isomorphic_check_done)
            const queryPreprocessed = logs.find(log => log.msg === 'query_preprocessed');
            const isomorphicCheckDone = logs.find(log => log.msg === 'isomorphic_check_done');
            let isomorphicCheck: number | null = null;
            if (queryPreprocessed && isomorphicCheckDone) {
                const preprocessedTime = new Date(queryPreprocessed.time).getTime();
                const checkTime = new Date(isomorphicCheckDone.time).getTime();
                isomorphicCheck = checkTime - preprocessedTime;
            }
            
            // Query Preprocessing (from query_preprocessing_started to query_preprocessed)
            const preprocessingStarted = logs.find(log => log.msg === 'query_preprocessing_started');
            const queryPreprocessedEnd = logs.find(log => log.msg === 'query_preprocessed');
            let queryPreprocessing: number | null = null;
            if (preprocessingStarted && queryPreprocessedEnd) {
                const startTime = new Date(preprocessingStarted.time).getTime();
                const finishTime = new Date(queryPreprocessedEnd.time).getTime();
                queryPreprocessing = finishTime - startTime;
            }
            
            // Event Preprocessing (sequential pairing)
            const eventPreprocessing: number[] = [];
            const preprocessingStartedEvents = logs.filter(log => log.msg === 'latest_event_received_preprocessing_started');
            const preprocessingCompletedEvents = logs.filter(log => log.msg === 'latest_event_received_preprocessing_completed_adding_to_rsp_engine_started');
            
            for (let i = 0; i < Math.min(preprocessingStartedEvents.length, preprocessingCompletedEvents.length); i++) {
                const startTime = new Date(preprocessingStartedEvents[i].time).getTime();
                const finishTime = new Date(preprocessingCompletedEvents[i].time).getTime();
                eventPreprocessing.push(finishTime - startTime);
            }
            
            // Adding to RSP Engine (sequential pairing)
            const addingToRSPEngine: number[] = [];
            const addingStartedEvents = logs.filter(log => log.msg === 'latest_event_received_preprocessing_completed_adding_to_rsp_engine_started');
            const addingFinishedEvents = logs.filter(log => log.msg === 'latest_event_added_to_rsp_engine');
            
            for (let i = 0; i < Math.min(addingStartedEvents.length, addingFinishedEvents.length); i++) {
                const startTime = new Date(addingStartedEvents[i].time).getTime();
                const finishTime = new Date(addingFinishedEvents[i].time).getTime();
                addingToRSPEngine.push(finishTime - startTime);
            }
            
            resolve({
                isomorphicCheck,
                queryPreprocessing,
                eventPreprocessing,
                addingToRSPEngine
            });
        });

        lineReader.on('error', () => {
            resolve({
                isomorphicCheck: null,
                queryPreprocessing: null,
                eventPreprocessing: [],
                addingToRSPEngine: []
            });
        });
    });
}

function calculateStats(values: number[]): { mean: number; stdDev: number; min: number; max: number } {
    if (values.length === 0) return { mean: 0, stdDev: 0, min: 0, max: 0 };
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return { mean, stdDev, min, max };
}

async function analyzeAllMetricsFiltered() {
    console.log("=== COMPREHENSIVE ANALYSIS - ITERATIONS 4-33 (30 ITERATIONS) ===");
    
    const isomorphicCheckTimes: number[] = [];
    const queryPreprocessingTimes: number[] = [];
    const allEventPreprocessingTimes: number[] = [];
    const allAddingToRSPTimes: number[] = [];
    
    // Process iterations 4-33 (30 iterations)
    for (let i = 4; i <= 33; i++) {
        const aggregatorLogsDir = path.join(baseDownloadsPath, i.toString(), "aggregator_logs");
        
        if (fs.existsSync(aggregatorLogsDir)) {
            const logFiles = fs.readdirSync(aggregatorLogsDir).filter(f => f.endsWith('.log'));
            
            // Find the largest log file (most likely the main experiment data)
            let largestLogFile = "";
            let largestSize = 0;
            
            for (const logFile of logFiles) {
                const fullPath = path.join(aggregatorLogsDir, logFile);
                const stats = fs.statSync(fullPath);
                if (stats.size > largestSize) {
                    largestSize = stats.size;
                    largestLogFile = fullPath;
                }
            }
            
            if (largestLogFile) {
                console.log(`Processing iteration ${i}: ${path.basename(largestLogFile)}`);
                const result = await processLogFile(largestLogFile);
                
                if (result.isomorphicCheck !== null) {
                    isomorphicCheckTimes.push(result.isomorphicCheck);
                    console.log(`  - Isomorphic check: ${result.isomorphicCheck}ms`);
                }
                
                if (result.queryPreprocessing !== null) {
                    queryPreprocessingTimes.push(result.queryPreprocessing);
                    console.log(`  - Query preprocessing: ${result.queryPreprocessing}ms`);
                }
                
                console.log(`  - Event preprocessing: ${result.eventPreprocessing.length} events`);
                console.log(`  - Adding to RSP engine: ${result.addingToRSPEngine.length} events`);
                
                allEventPreprocessingTimes.push(...result.eventPreprocessing);
                allAddingToRSPTimes.push(...result.addingToRSPEngine);
            } else {
                console.log(`Iteration ${i}: No log files found`);
            }
        } else {
            console.log(`Iteration ${i}: Directory not found`);
        }
    }
    
    // Calculate and display statistics
    console.log(`\n=== ISOMORPHIC CHECK STATISTICS ===`);
    if (isomorphicCheckTimes.length > 0) {
        const stats = calculateStats(isomorphicCheckTimes);
        console.log(`Measurements: ${isomorphicCheckTimes.length}/30 iterations`);
        console.log(`Average: ${stats.mean.toFixed(2)}ms`);
        console.log(`Standard deviation: ±${stats.stdDev.toFixed(2)}ms`);
        console.log(`Range: ${stats.min}ms - ${stats.max}ms`);
        console.log(`For table: ${stats.mean.toFixed(2)}ms ± ${stats.stdDev.toFixed(2)}ms (${isomorphicCheckTimes.length} iterations)`);
    } else {
        console.log(`No isomorphic check measurements found`);
    }
    
    console.log(`\n=== QUERY PREPROCESSING STATISTICS ===`);
    if (queryPreprocessingTimes.length > 0) {
        const stats = calculateStats(queryPreprocessingTimes);
        console.log(`Measurements: ${queryPreprocessingTimes.length}/30 iterations`);
        console.log(`Average: ${stats.mean.toFixed(2)}ms`);
        console.log(`Standard deviation: ±${stats.stdDev.toFixed(2)}ms`);
        console.log(`Range: ${stats.min}ms - ${stats.max}ms`);
        console.log(`For table: ${stats.mean.toFixed(1)}ms ± ${stats.stdDev.toFixed(1)}ms (${queryPreprocessingTimes.length} iterations)`);
    } else {
        console.log(`No query preprocessing measurements found`);
    }
    
    console.log(`\n=== EVENT PREPROCESSING STATISTICS ===`);
    if (allEventPreprocessingTimes.length > 0) {
        const stats = calculateStats(allEventPreprocessingTimes);
        console.log(`Total measurements: ${allEventPreprocessingTimes.length} events across 30 iterations`);
        console.log(`Average: ${stats.mean.toFixed(2)}ms`);
        console.log(`Standard deviation: ±${stats.stdDev.toFixed(2)}ms`);
        console.log(`Range: ${stats.min.toFixed(2)}ms - ${stats.max.toFixed(2)}ms`);
        console.log(`For table: ${stats.mean.toFixed(2)}ms ± ${stats.stdDev.toFixed(2)}ms (${allEventPreprocessingTimes.length} events)`);
    } else {
        console.log(`No event preprocessing measurements found`);
    }
    
    console.log(`\n=== ADDING TO RSP ENGINE STATISTICS ===`);
    if (allAddingToRSPTimes.length > 0) {
        const stats = calculateStats(allAddingToRSPTimes);
        console.log(`Total measurements: ${allAddingToRSPTimes.length} events across 30 iterations`);
        console.log(`Average: ${stats.mean.toFixed(2)}ms`);
        console.log(`Standard deviation: ±${stats.stdDev.toFixed(2)}ms`);
        console.log(`Range: ${stats.min.toFixed(2)}ms - ${stats.max.toFixed(2)}ms`);
        console.log(`For table: ${stats.mean.toFixed(2)}ms ± ${stats.stdDev.toFixed(2)}ms (${allAddingToRSPTimes.length} events)`);
    } else {
        console.log(`No RSP engine measurements found`);
    }
    
    console.log(`\n=== SUMMARY FOR TABLE UPDATES ===`);
    console.log(`All metrics calculated from filtered 30 iterations (4-33):`);
    
    if (isomorphicCheckTimes.length > 0) {
        const stats = calculateStats(isomorphicCheckTimes);
        console.log(`Query Isomorphic Check: ${stats.mean.toFixed(2)}ms ± ${stats.stdDev.toFixed(2)}ms`);
    }
    
    if (queryPreprocessingTimes.length > 0) {
        const stats = calculateStats(queryPreprocessingTimes);
        console.log(`Query Preprocessing: ${stats.mean.toFixed(1)}ms ± ${stats.stdDev.toFixed(1)}ms`);
    }
    
    if (allEventPreprocessingTimes.length > 0) {
        const stats = calculateStats(allEventPreprocessingTimes);
        console.log(`Event Preprocessing: ${stats.mean.toFixed(2)}ms ± ${stats.stdDev.toFixed(2)}ms`);
    }
    
    if (allAddingToRSPTimes.length > 0) {
        const stats = calculateStats(allAddingToRSPTimes);
        console.log(`Adding Event to RSP Engine: ${stats.mean.toFixed(2)}ms ± ${stats.stdDev.toFixed(2)}ms`);
    }
}

analyzeAllMetricsFiltered();
