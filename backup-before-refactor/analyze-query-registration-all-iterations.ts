import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const baseDownloadsPath = "/Users/kushbisen/Downloads/1client";

interface LogEntry {
    msg: string;
    time: string;
}

async function processLogFile(logFilePath: string): Promise<number | null> {
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
            
            const queryReceived = logs.find(log => log.msg === 'new_query_received_from_client_ws');
            const queryRegistered = logs.find(log => log.msg === 'unique_query_registered');
            
            if (queryReceived && queryRegistered) {
                const queryReceivedTime = new Date(queryReceived.time).getTime();
                const queryRegisteredTime = new Date(queryRegistered.time).getTime();
                const timeDiff = queryRegisteredTime - queryReceivedTime;
                resolve(timeDiff);
            } else {
                resolve(null);
            }
        });

        lineReader.on('error', () => {
            resolve(null);
        });
    });
}

async function analyzeAllIterations() {
    console.log("=== ANALYZING QUERY REGISTRATION ACROSS ALL 35 ITERATIONS ===");
    
    const registrationTimes: number[] = [];
    const iterationResults: { iteration: number, time: number | null }[] = [];
    
    // Process all 35 iterations
    for (let i = 1; i <= 35; i++) {
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
                console.log(`Processing iteration ${i}: ${path.basename(largestLogFile)} (${largestSize} bytes)`);
                const registrationTime = await processLogFile(largestLogFile);
                
                iterationResults.push({ iteration: i, time: registrationTime });
                
                if (registrationTime !== null) {
                    registrationTimes.push(registrationTime);
                    console.log(`  - Query registration time: ${registrationTime}ms`);
                } else {
                    console.log(`  - No query registration found`);
                }
            } else {
                console.log(`Iteration ${i}: No log files found`);
                iterationResults.push({ iteration: i, time: null });
            }
        } else {
            console.log(`Iteration ${i}: Directory not found`);
            iterationResults.push({ iteration: i, time: null });
        }
    }
    
    // Calculate statistics
    if (registrationTimes.length > 0) {
        const mean = registrationTimes.reduce((sum, time) => sum + time, 0) / registrationTimes.length;
        const squaredDifferences = registrationTimes.map(time => Math.pow(time - mean, 2));
        const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / registrationTimes.length;
        const standardDeviation = Math.sqrt(variance);
        const minTime = Math.min(...registrationTimes);
        const maxTime = Math.max(...registrationTimes);
        
        console.log(`\n=== QUERY REGISTRATION STATISTICS (${registrationTimes.length} iterations) ===`);
        console.log(`Successful measurements: ${registrationTimes.length} out of 35 iterations`);
        console.log(`Average registration time: ${mean.toFixed(2)}ms`);
        console.log(`Standard deviation: ±${standardDeviation.toFixed(2)}ms`);
        console.log(`Minimum: ${minTime}ms`);
        console.log(`Maximum: ${maxTime}ms`);
        console.log(`Range: ${maxTime - minTime}ms`);
        
        console.log(`\n=== FOR TABLE ===`);
        console.log(`Query Register: ${mean.toFixed(2)}ms ± ${standardDeviation.toFixed(2)}ms (${registrationTimes.length} iterations)`);
        
        // Show distribution
        console.log(`\n=== DISTRIBUTION ===`);
        const under50 = registrationTimes.filter(t => t < 50).length;
        const range50_100 = registrationTimes.filter(t => t >= 50 && t < 100).length;
        const range100_150 = registrationTimes.filter(t => t >= 100 && t < 150).length;
        const over150 = registrationTimes.filter(t => t >= 150).length;
        
        console.log(`< 50ms: ${under50} iterations`);
        console.log(`50-99ms: ${range50_100} iterations`);
        console.log(`100-149ms: ${range100_150} iterations`);
        console.log(`≥ 150ms: ${over150} iterations`);
        
        // Show a sample of individual measurements
        console.log(`\n=== SAMPLE MEASUREMENTS ===`);
        registrationTimes.slice(0, 10).forEach((time, index) => {
            const iteration = iterationResults.find(r => r.time === time);
            console.log(`Iteration ${iteration?.iteration}: ${time}ms`);
        });
        
    } else {
        console.log(`\n=== NO QUERY REGISTRATIONS FOUND ===`);
        console.log(`No valid query registration measurements found across any iterations`);
    }
    
    // Summary of failed iterations
    const failedIterations = iterationResults.filter(r => r.time === null);
    if (failedIterations.length > 0) {
        console.log(`\n=== FAILED ITERATIONS ===`);
        console.log(`Iterations with no query registration data: ${failedIterations.map(r => r.iteration).join(', ')}`);
    }
}

analyzeAllIterations();
