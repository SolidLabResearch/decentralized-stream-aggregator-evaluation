import * as fs from "fs";
import * as readline from "readline";

const logFile = "/Users/kushbisen/Downloads/1client/1/aggregator_logs/aggregator-2025-09-15-13-07-20.log";

interface LogEntry {
    msg: string;
    time: string;
}

async function analyzeGetRequests() {
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
                console.log(`GET request ${getRequestTimes.length}: ${timeDiff}ms`);
            }
        }
        
        if (getRequestTimes.length > 0) {
            const totalTime = getRequestTimes.reduce((sum, time) => sum + time, 0);
            const averageTime = totalTime / getRequestTimes.length;
            const minTime = Math.min(...getRequestTimes);
            const maxTime = Math.max(...getRequestTimes);
            
            console.log(`\n=== GET REQUEST ANALYSIS ===`);
            console.log(`Number of individual GET requests: ${getRequestTimes.length}`);
            console.log(`Total GET request time: ${totalTime}ms`);
            console.log(`Average GET request time: ${averageTime.toFixed(2)}ms`);
            console.log(`Minimum GET request time: ${minTime}ms`);
            console.log(`Maximum GET request time: ${maxTime}ms`);
            
            // Show distribution
            console.log(`\n=== DISTRIBUTION ===`);
            const under10 = getRequestTimes.filter(t => t < 10).length;
            const under20 = getRequestTimes.filter(t => t >= 10 && t < 20).length;
            const under50 = getRequestTimes.filter(t => t >= 20 && t < 50).length;
            const over50 = getRequestTimes.filter(t => t >= 50).length;
            
            console.log(`< 10ms: ${under10} requests`);
            console.log(`10-19ms: ${under20} requests`);
            console.log(`20-49ms: ${under50} requests`);
            console.log(`≥ 50ms: ${over50} requests`);
        } else {
            console.log("No GET request sequences found!");
        }
    });
}

analyzeGetRequests();
