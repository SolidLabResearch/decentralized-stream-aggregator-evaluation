import * as fs from "fs";
import * as readline from "readline";

const logFile = "/Users/kushbisen/Downloads/1client/1/aggregator_logs/aggregator-2025-09-15-13-07-20.log";

interface LogEntry {
    msg: string;
    time: string;
}

async function calculateGetRequestStats() {
    const logs: LogEntry[] = [];
    const lineReader = readline.createInterface({
        input: fs.createReadStream(logFile),
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
        
        const getRequestTimes: number[] = [];
        
        for (let i = 1; i < logs.length; i++) {
            const prevLog = logs[i - 1];
            const currentLog = logs[i];
            
            // Look for webhook_notification_received followed by latest_event_received_preprocessing_started
            if (prevLog.msg === 'webhook_notification_received' && 
                currentLog.msg === 'latest_event_received_preprocessing_started') {
                
                const time1 = new Date(prevLog.time).getTime();
                const time2 = new Date(currentLog.time).getTime();
                const timeDiff = time2 - time1;
                
                getRequestTimes.push(timeDiff);
            }
        }
        
        if (getRequestTimes.length > 0) {
            // Calculate statistics
            const mean = getRequestTimes.reduce((sum, time) => sum + time, 0) / getRequestTimes.length;
            
            // Calculate variance and standard deviation
            const squaredDifferences = getRequestTimes.map(time => Math.pow(time - mean, 2));
            const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / getRequestTimes.length;
            const standardDeviation = Math.sqrt(variance);
            
            const minTime = Math.min(...getRequestTimes);
            const maxTime = Math.max(...getRequestTimes);
            
            // Calculate median
            const sortedTimes = [...getRequestTimes].sort((a, b) => a - b);
            const median = sortedTimes.length % 2 === 0 
                ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
                : sortedTimes[Math.floor(sortedTimes.length / 2)];
            
            console.log(`=== GET REQUEST STATISTICS ===`);
            console.log(`Number of requests: ${getRequestTimes.length}`);
            console.log(`Mean: ${mean.toFixed(2)}ms`);
            console.log(`Standard Deviation: ±${standardDeviation.toFixed(2)}ms`);
            console.log(`Variance: ${variance.toFixed(2)}ms²`);
            console.log(`Median: ${median}ms`);
            console.log(`Minimum: ${minTime}ms`);
            console.log(`Maximum: ${maxTime}ms`);
            console.log(`Range: ${maxTime - minTime}ms`);
            
            console.log(`\nFormatted for table: ${mean.toFixed(2)}ms ± ${standardDeviation.toFixed(2)}ms`);
            
            // Calculate percentiles
            const p25 = sortedTimes[Math.floor(getRequestTimes.length * 0.25)];
            const p75 = sortedTimes[Math.floor(getRequestTimes.length * 0.75)];
            const p95 = sortedTimes[Math.floor(getRequestTimes.length * 0.95)];
            
            console.log(`\n=== PERCENTILES ===`);
            console.log(`25th percentile: ${p25}ms`);
            console.log(`50th percentile (median): ${median}ms`);
            console.log(`75th percentile: ${p75}ms`);
            console.log(`95th percentile: ${p95}ms`);
        } else {
            console.log("No GET request sequences found!");
        }
    });
}

calculateGetRequestStats();
