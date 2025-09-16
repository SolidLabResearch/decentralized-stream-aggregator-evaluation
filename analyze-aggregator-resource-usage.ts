import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const baseDownloadsPath = "/Users/kushbisen/Downloads/1client";

interface LogEntry {
    msg: string;
    time: string;
    [key: string]: any;
}

interface ResourceMetrics {
    iteration: number;
    totalEvents: number;
    totalProcessingTime: number;
    averageEventProcessingTime: number;
    queryRegistrationTime: number | null;
    queryPreprocessingTime: number | null;
    subscriptionTime: number | null;
    eventPreprocessingTime: number[];
    rspEngineAddingTime: number[];
    getRequestTime: number[];
    memoryEfficiency: number;
    throughput: number;
    systemUtilization: number;
}

async function processLogFile(logFilePath: string, iteration: number): Promise<ResourceMetrics> {
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
            
            const metrics = calculateResourceMetrics(logs, iteration);
            resolve(metrics);
        });

        lineReader.on('error', () => {
            resolve({
                iteration,
                totalEvents: 0,
                totalProcessingTime: 0,
                averageEventProcessingTime: 0,
                queryRegistrationTime: null,
                queryPreprocessingTime: null,
                subscriptionTime: null,
                eventPreprocessingTime: [],
                rspEngineAddingTime: [],
                getRequestTime: [],
                memoryEfficiency: 0,
                throughput: 0,
                systemUtilization: 0
            });
        });
    });
}

function calculateResourceMetrics(logs: LogEntry[], iteration: number): ResourceMetrics {
    // Query Registration Time
    const queryReceived = logs.find(log => log.msg === 'new_query_received_from_client_ws');
    const queryRegistered = logs.find(log => log.msg === 'unique_query_registered');
    let queryRegistrationTime: number | null = null;
    if (queryReceived && queryRegistered) {
        queryRegistrationTime = new Date(queryRegistered.time).getTime() - new Date(queryReceived.time).getTime();
    }

    // Query Preprocessing Time
    const preprocessingStarted = logs.find(log => log.msg === 'query_preprocessing_started');
    const queryPreprocessed = logs.find(log => log.msg === 'query_preprocessed');
    let queryPreprocessingTime: number | null = null;
    if (preprocessingStarted && queryPreprocessed) {
        queryPreprocessingTime = new Date(queryPreprocessed.time).getTime() - new Date(preprocessingStarted.time).getTime();
    }

    // Subscription Time (average of 3 streams)
    const successfulSubscriptions = logs.filter(log => log.msg === 'subscription_to_ldes_stream_was_successful');
    let subscriptionTime: number | null = null;
    if (queryRegistered && successfulSubscriptions.length === 3) {
        const queryTime = new Date(queryRegistered.time).getTime();
        const subscriptionTimes = successfulSubscriptions.map(sub => {
            return new Date(sub.time).getTime() - queryTime;
        });
        subscriptionTime = subscriptionTimes.reduce((sum, time) => sum + time, 0) / subscriptionTimes.length;
    }

    // Event Processing Times
    const eventPreprocessingStarted = logs.filter(log => log.msg === 'latest_event_received_preprocessing_started');
    const eventPreprocessingCompleted = logs.filter(log => log.msg === 'latest_event_received_preprocessing_completed_adding_to_rsp_engine_started');
    const eventPreprocessingTime: number[] = [];
    
    for (let i = 0; i < Math.min(eventPreprocessingStarted.length, eventPreprocessingCompleted.length); i++) {
        const startTime = new Date(eventPreprocessingStarted[i].time).getTime();
        const completedTime = new Date(eventPreprocessingCompleted[i].time).getTime();
        eventPreprocessingTime.push(completedTime - startTime);
    }

    // RSP Engine Adding Times
    const rspEngineStarted = logs.filter(log => log.msg === 'latest_event_received_preprocessing_completed_adding_to_rsp_engine_started');
    const rspEngineAdded = logs.filter(log => log.msg === 'latest_event_added_to_rsp_engine');
    const rspEngineAddingTime: number[] = [];
    
    for (let i = 0; i < Math.min(rspEngineStarted.length, rspEngineAdded.length); i++) {
        const startTime = new Date(rspEngineStarted[i].time).getTime();
        const addedTime = new Date(rspEngineAdded[i].time).getTime();
        rspEngineAddingTime.push(addedTime - startTime);
    }

    // GET Request Times (webhook to preprocessing)
    const webhookNotifications = logs.filter(log => log.msg === 'webhook_notification_received');
    const preprocessingStartedEvents = logs.filter(log => log.msg === 'latest_event_received_preprocessing_started');
    const getRequestTime: number[] = [];
    
    for (let i = 0; i < Math.min(webhookNotifications.length, preprocessingStartedEvents.length); i++) {
        const webhookTime = new Date(webhookNotifications[i].time).getTime();
        const preprocessingTime = new Date(preprocessingStartedEvents[i].time).getTime();
        getRequestTime.push(preprocessingTime - webhookTime);
    }

    // Calculate Total Processing Time
    const firstLog = logs[0];
    const lastLog = logs[logs.length - 1];
    const totalProcessingTime = firstLog && lastLog ? 
        new Date(lastLog.time).getTime() - new Date(firstLog.time).getTime() : 0;

    // Calculate Metrics
    const totalEvents = eventPreprocessingTime.length;
    const averageEventProcessingTime = eventPreprocessingTime.length > 0 ?
        eventPreprocessingTime.reduce((sum, time) => sum + time, 0) / eventPreprocessingTime.length : 0;

    // Calculate Throughput (events per second)
    const throughput = totalProcessingTime > 0 ? (totalEvents * 1000) / totalProcessingTime : 0;

    // Calculate Memory Efficiency (events per ms of total processing time)
    const memoryEfficiency = totalProcessingTime > 0 ? totalEvents / totalProcessingTime : 0;

    // Calculate System Utilization (percentage of time spent on event processing vs total time)
    const totalEventProcessingTime = eventPreprocessingTime.reduce((sum, time) => sum + time, 0) +
                                   rspEngineAddingTime.reduce((sum, time) => sum + time, 0);
    const systemUtilization = totalProcessingTime > 0 ? 
        (totalEventProcessingTime / totalProcessingTime) * 100 : 0;

    return {
        iteration,
        totalEvents,
        totalProcessingTime,
        averageEventProcessingTime,
        queryRegistrationTime,
        queryPreprocessingTime,
        subscriptionTime,
        eventPreprocessingTime,
        rspEngineAddingTime,
        getRequestTime,
        memoryEfficiency,
        throughput,
        systemUtilization
    };
}

function calculateStats(values: number[]): { mean: number; stdDev: number; min: number; max: number; median: number } {
    if (values.length === 0) return { mean: 0, stdDev: 0, min: 0, max: 0, median: 0 };
    
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    return { mean, stdDev, min, max, median };
}

async function analyzeResourceUsageFiltered() {
    console.log("=== RESOURCE USAGE ANALYSIS - AGGREGATOR APPROACH (30 ITERATIONS) ===");
    console.log("Analyzing iterations 4-33 (filtered, excluding first 3 and last 2)\n");
    
    const allMetrics: ResourceMetrics[] = [];
    
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
                const metrics = await processLogFile(largestLogFile, i);
                allMetrics.push(metrics);
                
                console.log(`  - Total events: ${metrics.totalEvents}`);
                console.log(`  - Total processing time: ${(metrics.totalProcessingTime / 1000).toFixed(2)}s`);
                console.log(`  - Throughput: ${metrics.throughput.toFixed(2)} events/sec`);
                console.log(`  - System utilization: ${metrics.systemUtilization.toFixed(2)}%`);
            } else {
                console.log(`Iteration ${i}: No log files found`);
            }
        } else {
            console.log(`Iteration ${i}: Directory not found`);
        }
    }
    
    if (allMetrics.length === 0) {
        console.log("No valid metrics found!");
        return;
    }
    
    // Calculate Aggregate Statistics
    console.log(`\n=== AGGREGATE RESOURCE USAGE STATISTICS (${allMetrics.length} iterations) ===`);
    
    const totalEvents = allMetrics.map(m => m.totalEvents);
    const totalProcessingTimes = allMetrics.map(m => m.totalProcessingTime / 1000); // Convert to seconds
    const throughputs = allMetrics.map(m => m.throughput);
    const systemUtilizations = allMetrics.map(m => m.systemUtilization);
    const memoryEfficiencies = allMetrics.map(m => m.memoryEfficiency * 1000); // Events per second
    
    const eventStats = calculateStats(totalEvents);
    const processingTimeStats = calculateStats(totalProcessingTimes);
    const throughputStats = calculateStats(throughputs);
    const utilizationStats = calculateStats(systemUtilizations);
    const memoryStats = calculateStats(memoryEfficiencies);
    
    console.log(`\n📊 TOTAL EVENTS PER ITERATION:`);
    console.log(`   Average: ${eventStats.mean.toFixed(0)} events`);
    console.log(`   Range: ${eventStats.min} - ${eventStats.max} events`);
    console.log(`   Standard deviation: ±${eventStats.stdDev.toFixed(0)} events`);
    
    console.log(`\n⏱️  TOTAL PROCESSING TIME PER ITERATION:`);
    console.log(`   Average: ${processingTimeStats.mean.toFixed(2)} seconds`);
    console.log(`   Range: ${processingTimeStats.min.toFixed(2)} - ${processingTimeStats.max.toFixed(2)} seconds`);
    console.log(`   Standard deviation: ±${processingTimeStats.stdDev.toFixed(2)} seconds`);
    
    console.log(`\n🚀 THROUGHPUT (Events/Second):`);
    console.log(`   Average: ${throughputStats.mean.toFixed(2)} events/sec`);
    console.log(`   Range: ${throughputStats.min.toFixed(2)} - ${throughputStats.max.toFixed(2)} events/sec`);
    console.log(`   Standard deviation: ±${throughputStats.stdDev.toFixed(2)} events/sec`);
    
    console.log(`\n💻 SYSTEM UTILIZATION (% of time processing events):`);
    console.log(`   Average: ${utilizationStats.mean.toFixed(2)}%`);
    console.log(`   Range: ${utilizationStats.min.toFixed(2)}% - ${utilizationStats.max.toFixed(2)}%`);
    console.log(`   Standard deviation: ±${utilizationStats.stdDev.toFixed(2)}%`);
    
    console.log(`\n🧠 MEMORY EFFICIENCY (Events/Second Normalized):`);
    console.log(`   Average: ${memoryStats.mean.toFixed(2)} events/sec`);
    console.log(`   Range: ${memoryStats.min.toFixed(2)} - ${memoryStats.max.toFixed(2)} events/sec`);
    console.log(`   Standard deviation: ±${memoryStats.stdDev.toFixed(2)} events/sec`);
    
    // Setup Phase Analysis
    const queryRegTimes = allMetrics.filter(m => m.queryRegistrationTime !== null).map(m => m.queryRegistrationTime!);
    const queryPrepTimes = allMetrics.filter(m => m.queryPreprocessingTime !== null).map(m => m.queryPreprocessingTime!);
    const subscriptionTimes = allMetrics.filter(m => m.subscriptionTime !== null).map(m => m.subscriptionTime!);
    
    if (queryRegTimes.length > 0) {
        const queryRegStats = calculateStats(queryRegTimes);
        console.log(`\n🔧 SETUP PHASE - QUERY REGISTRATION:`);
        console.log(`   Average: ${queryRegStats.mean.toFixed(2)}ms`);
        console.log(`   Range: ${queryRegStats.min}ms - ${queryRegStats.max}ms`);
        console.log(`   Standard deviation: ±${queryRegStats.stdDev.toFixed(2)}ms`);
    }
    
    if (queryPrepTimes.length > 0) {
        const queryPrepStats = calculateStats(queryPrepTimes);
        console.log(`\n⚙️  SETUP PHASE - QUERY PREPROCESSING:`);
        console.log(`   Average: ${queryPrepStats.mean.toFixed(2)}ms`);
        console.log(`   Range: ${queryPrepStats.min}ms - ${queryPrepStats.max}ms`);
        console.log(`   Standard deviation: ±${queryPrepStats.stdDev.toFixed(2)}ms`);
    }
    
    if (subscriptionTimes.length > 0) {
        const subscriptionStats = calculateStats(subscriptionTimes);
        console.log(`\n📡 SETUP PHASE - STREAM SUBSCRIPTION:`);
        console.log(`   Average: ${subscriptionStats.mean.toFixed(2)}ms`);
        console.log(`   Range: ${subscriptionStats.min.toFixed(2)}ms - ${subscriptionStats.max.toFixed(2)}ms`);
        console.log(`   Standard deviation: ±${subscriptionStats.stdDev.toFixed(2)}ms`);
    }
    
    // Event Processing Analysis
    const allEventPreprocessing = allMetrics.flatMap(m => m.eventPreprocessingTime);
    const allRspEngineAdding = allMetrics.flatMap(m => m.rspEngineAddingTime);
    const allGetRequests = allMetrics.flatMap(m => m.getRequestTime);
    
    if (allEventPreprocessing.length > 0) {
        const eventPrepStats = calculateStats(allEventPreprocessing);
        console.log(`\n📋 EVENT PROCESSING - PREPROCESSING:`);
        console.log(`   Total events processed: ${allEventPreprocessing.length}`);
        console.log(`   Average: ${eventPrepStats.mean.toFixed(2)}ms per event`);
        console.log(`   Range: ${eventPrepStats.min.toFixed(2)}ms - ${eventPrepStats.max.toFixed(2)}ms`);
        console.log(`   Standard deviation: ±${eventPrepStats.stdDev.toFixed(2)}ms`);
    }
    
    if (allRspEngineAdding.length > 0) {
        const rspEngineStats = calculateStats(allRspEngineAdding);
        console.log(`\n🔧 EVENT PROCESSING - RSP ENGINE ADDING:`);
        console.log(`   Total events processed: ${allRspEngineAdding.length}`);
        console.log(`   Average: ${rspEngineStats.mean.toFixed(2)}ms per event`);
        console.log(`   Range: ${rspEngineStats.min.toFixed(2)}ms - ${rspEngineStats.max.toFixed(2)}ms`);
        console.log(`   Standard deviation: ±${rspEngineStats.stdDev.toFixed(2)}ms`);
    }
    
    if (allGetRequests.length > 0) {
        const getRequestStats = calculateStats(allGetRequests);
        console.log(`\n🌐 NETWORK - GET REQUEST TIMING:`);
        console.log(`   Total GET requests: ${allGetRequests.length}`);
        console.log(`   Average: ${getRequestStats.mean.toFixed(2)}ms per request`);
        console.log(`   Range: ${getRequestStats.min.toFixed(2)}ms - ${getRequestStats.max.toFixed(2)}ms`);
        console.log(`   Standard deviation: ±${getRequestStats.stdDev.toFixed(2)}ms`);
    }
    
    // Performance Summary Table
    console.log(`\n📈 PERFORMANCE SUMMARY TABLE:`);
    console.log(`| Metric | Average | Min | Max | Std Dev |`);
    console.log(`|--------|---------|-----|-----|---------|`);
    console.log(`| Events per iteration | ${eventStats.mean.toFixed(0)} | ${eventStats.min} | ${eventStats.max} | ±${eventStats.stdDev.toFixed(0)} |`);
    console.log(`| Processing time (sec) | ${processingTimeStats.mean.toFixed(2)} | ${processingTimeStats.min.toFixed(2)} | ${processingTimeStats.max.toFixed(2)} | ±${processingTimeStats.stdDev.toFixed(2)} |`);
    console.log(`| Throughput (events/sec) | ${throughputStats.mean.toFixed(2)} | ${throughputStats.min.toFixed(2)} | ${throughputStats.max.toFixed(2)} | ±${throughputStats.stdDev.toFixed(2)} |`);
    console.log(`| System utilization (%) | ${utilizationStats.mean.toFixed(2)} | ${utilizationStats.min.toFixed(2)} | ${utilizationStats.max.toFixed(2)} | ±${utilizationStats.stdDev.toFixed(2)} |`);
    console.log(`| Event preprocessing (ms) | ${allEventPreprocessing.length > 0 ? calculateStats(allEventPreprocessing).mean.toFixed(2) : 'N/A'} | ${allEventPreprocessing.length > 0 ? calculateStats(allEventPreprocessing).min.toFixed(2) : 'N/A'} | ${allEventPreprocessing.length > 0 ? calculateStats(allEventPreprocessing).max.toFixed(2) : 'N/A'} | ${allEventPreprocessing.length > 0 ? '±' + calculateStats(allEventPreprocessing).stdDev.toFixed(2) : 'N/A'} |`);
    console.log(`| RSP engine adding (ms) | ${allRspEngineAdding.length > 0 ? calculateStats(allRspEngineAdding).mean.toFixed(2) : 'N/A'} | ${allRspEngineAdding.length > 0 ? calculateStats(allRspEngineAdding).min.toFixed(2) : 'N/A'} | ${allRspEngineAdding.length > 0 ? calculateStats(allRspEngineAdding).max.toFixed(2) : 'N/A'} | ${allRspEngineAdding.length > 0 ? '±' + calculateStats(allRspEngineAdding).stdDev.toFixed(2) : 'N/A'} |`);
    console.log(`| GET request timing (ms) | ${allGetRequests.length > 0 ? calculateStats(allGetRequests).mean.toFixed(2) : 'N/A'} | ${allGetRequests.length > 0 ? calculateStats(allGetRequests).min.toFixed(2) : 'N/A'} | ${allGetRequests.length > 0 ? calculateStats(allGetRequests).max.toFixed(2) : 'N/A'} | ${allGetRequests.length > 0 ? '±' + calculateStats(allGetRequests).stdDev.toFixed(2) : 'N/A'} |`);
    
    // Resource Efficiency Analysis
    const totalEventsProcessed = allMetrics.reduce((sum, m) => sum + m.totalEvents, 0);
    const totalTimeSpent = allMetrics.reduce((sum, m) => sum + m.totalProcessingTime, 0) / 1000; // seconds
    const overallThroughput = totalTimeSpent > 0 ? totalEventsProcessed / totalTimeSpent : 0;
    
    console.log(`\n🎯 OVERALL RESOURCE EFFICIENCY (30 iterations combined):`);
    console.log(`   Total events processed: ${totalEventsProcessed.toLocaleString()}`);
    console.log(`   Total time spent: ${(totalTimeSpent / 60).toFixed(2)} minutes`);
    console.log(`   Overall throughput: ${overallThroughput.toFixed(2)} events/sec`);
    console.log(`   Average events per iteration: ${(totalEventsProcessed / allMetrics.length).toFixed(0)}`);
    console.log(`   Average time per iteration: ${(totalTimeSpent / allMetrics.length).toFixed(2)} seconds`);
}

analyzeResourceUsageFiltered();
