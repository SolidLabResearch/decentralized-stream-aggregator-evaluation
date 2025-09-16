import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const baseDownloadsPath = "/Users/kushbisen/Downloads/1client";

interface LogEntry {
    msg: string;
    time: string;
}

async function processLogFile(logFilePath: string): Promise<{queryRegistration: number | null, subscriptionTiming: number | null}> {
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
            
            // Query registration timing
            const queryReceived = logs.find(log => log.msg === 'new_query_received_from_client_ws');
            const queryRegistered = logs.find(log => log.msg === 'unique_query_registered');
            
            let queryRegistrationTime: number | null = null;
            if (queryReceived && queryRegistered) {
                const queryReceivedTime = new Date(queryReceived.time).getTime();
                const queryRegisteredTime = new Date(queryRegistered.time).getTime();
                queryRegistrationTime = queryRegisteredTime - queryReceivedTime;
            }
            
            // Subscription timing
            const successfulSubscriptions = logs.filter(log => log.msg === 'subscription_to_ldes_stream_was_successful');
            
            let subscriptionTime: number | null = null;
            if (queryRegistered && successfulSubscriptions.length === 3) {
                const queryTime = new Date(queryRegistered.time).getTime();
                const subscriptionTimes = successfulSubscriptions.map(sub => {
                    const subscriptionTime = new Date(sub.time).getTime();
                    return subscriptionTime - queryTime;
                });
                // Average of the 3 streams
                subscriptionTime = subscriptionTimes.reduce((sum, time) => sum + time, 0) / subscriptionTimes.length;
            }
            
            resolve({ queryRegistration: queryRegistrationTime, subscriptionTiming: subscriptionTime });
        });

        lineReader.on('error', () => {
            resolve({ queryRegistration: null, subscriptionTiming: null });
        });
    });
}

async function analyzeFilteredIterations() {
    console.log("=== ANALYZING ITERATIONS 4-33 (30 ITERATIONS, EXCLUDING FIRST 3 AND LAST 2) ===");
    
    const queryRegistrationTimes: number[] = [];
    const subscriptionTimes: number[] = [];
    const iterationResults: { iteration: number, queryReg: number | null, subscription: number | null }[] = [];
    
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
                
                iterationResults.push({ 
                    iteration: i, 
                    queryReg: result.queryRegistration, 
                    subscription: result.subscriptionTiming 
                });
                
                if (result.queryRegistration !== null) {
                    queryRegistrationTimes.push(result.queryRegistration);
                    console.log(`  - Query registration: ${result.queryRegistration}ms`);
                } else {
                    console.log(`  - Query registration: FAILED`);
                }
                
                if (result.subscriptionTiming !== null) {
                    subscriptionTimes.push(result.subscriptionTiming);
                    console.log(`  - Subscription timing: ${result.subscriptionTiming.toFixed(2)}ms`);
                } else {
                    console.log(`  - Subscription timing: FAILED`);
                }
            } else {
                console.log(`Iteration ${i}: No log files found`);
                iterationResults.push({ iteration: i, queryReg: null, subscription: null });
            }
        } else {
            console.log(`Iteration ${i}: Directory not found`);
            iterationResults.push({ iteration: i, queryReg: null, subscription: null });
        }
    }
    
    // Calculate Query Registration Statistics
    if (queryRegistrationTimes.length > 0) {
        const mean = queryRegistrationTimes.reduce((sum, time) => sum + time, 0) / queryRegistrationTimes.length;
        const squaredDifferences = queryRegistrationTimes.map(time => Math.pow(time - mean, 2));
        const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / queryRegistrationTimes.length;
        const standardDeviation = Math.sqrt(variance);
        const minTime = Math.min(...queryRegistrationTimes);
        const maxTime = Math.max(...queryRegistrationTimes);
        
        console.log(`\n=== QUERY REGISTRATION STATISTICS (${queryRegistrationTimes.length}/30 iterations) ===`);
        console.log(`Average registration time: ${mean.toFixed(2)}ms`);
        console.log(`Standard deviation: ±${standardDeviation.toFixed(2)}ms`);
        console.log(`Minimum: ${minTime}ms`);
        console.log(`Maximum: ${maxTime}ms`);
        console.log(`Range: ${maxTime - minTime}ms`);
        console.log(`\nFor table: ${mean.toFixed(2)}ms ± ${standardDeviation.toFixed(2)}ms (${queryRegistrationTimes.length} iterations)`);
    }
    
    // Calculate Subscription Statistics
    if (subscriptionTimes.length > 0) {
        const mean = subscriptionTimes.reduce((sum, time) => sum + time, 0) / subscriptionTimes.length;
        const squaredDifferences = subscriptionTimes.map(time => Math.pow(time - mean, 2));
        const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / subscriptionTimes.length;
        const standardDeviation = Math.sqrt(variance);
        const minTime = Math.min(...subscriptionTimes);
        const maxTime = Math.max(...subscriptionTimes);
        
        console.log(`\n=== SUBSCRIPTION TIMING STATISTICS (${subscriptionTimes.length}/30 iterations) ===`);
        console.log(`Average subscription time: ${mean.toFixed(2)}ms`);
        console.log(`Standard deviation: ±${standardDeviation.toFixed(2)}ms`);
        console.log(`Minimum: ${minTime.toFixed(2)}ms`);
        console.log(`Maximum: ${maxTime.toFixed(2)}ms`);
        console.log(`Range: ${(maxTime - minTime).toFixed(2)}ms`);
        console.log(`\nFor table: ${mean.toFixed(2)}ms ± ${standardDeviation.toFixed(2)}ms (${subscriptionTimes.length} iterations)`);
    }
    
    // Show comparison with original data
    console.log(`\n=== COMPARISON ===`);
    console.log(`Original (iterations 1-35): Query Registration had 35 measurements`);
    console.log(`Filtered (iterations 4-33): Query Registration has ${queryRegistrationTimes.length} measurements`);
    console.log(`Filtered (iterations 4-33): Subscription timing has ${subscriptionTimes.length} measurements`);
    
    // Summary for table updates
    console.log(`\n=== TABLE UPDATES ===`);
    if (queryRegistrationTimes.length > 0) {
        const queryMean = queryRegistrationTimes.reduce((sum, time) => sum + time, 0) / queryRegistrationTimes.length;
        const queryStdDev = Math.sqrt(queryRegistrationTimes.map(time => Math.pow(time - queryMean, 2)).reduce((sum, sq) => sum + sq, 0) / queryRegistrationTimes.length);
        console.log(`Query Register: ${queryMean.toFixed(2)}ms ± ${queryStdDev.toFixed(2)}ms (30 iterations)`);
    }
    
    if (subscriptionTimes.length > 0) {
        const subMean = subscriptionTimes.reduce((sum, time) => sum + time, 0) / subscriptionTimes.length;
        const subStdDev = Math.sqrt(subscriptionTimes.map(time => Math.pow(time - subMean, 2)).reduce((sum, sq) => sum + sq, 0) / subscriptionTimes.length);
        console.log(`Subscribing Stream: ${subMean.toFixed(2)}ms ± ${subStdDev.toFixed(2)}ms (30 iterations)`);
    }
}

analyzeFilteredIterations();
