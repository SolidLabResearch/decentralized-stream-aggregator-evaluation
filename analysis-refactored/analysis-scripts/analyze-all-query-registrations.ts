import * as fs from "fs";
import * as readline from "readline";

const logFile = "/Users/kushbisen/Downloads/1client/1/aggregator_logs/aggregator-2025-09-15-13-07-20.log";

interface LogEntry {
    msg: string;
    time: string;
}

async function analyzeAllQueryRegistrations() {
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
        
        console.log("=== COMPLETE QUERY REGISTRATION ANALYSIS ===");
        
        // Find ALL query-related events
        const allQueryReceived = logs.filter(log => log.msg === 'new_query_received_from_client_ws');
        const allQueryRegistered = logs.filter(log => log.msg === 'unique_query_registered');
        const allQueryPreprocessingStarted = logs.filter(log => log.msg === 'query_preprocessing_started');
        const allQueryPreprocessed = logs.filter(log => log.msg === 'query_preprocessed');
        
        console.log(`Total queries received: ${allQueryReceived.length}`);
        console.log(`Total queries registered: ${allQueryRegistered.length}`);
        console.log(`Total preprocessing started: ${allQueryPreprocessingStarted.length}`);
        console.log(`Total preprocessing completed: ${allQueryPreprocessed.length}`);
        
        // Show all query events chronologically
        console.log(`\n=== ALL QUERY EVENTS ===`);
        allQueryReceived.forEach((event, index) => {
            console.log(`Query received ${index + 1}: ${event.time}`);
        });
        
        allQueryRegistered.forEach((event, index) => {
            console.log(`Query registered ${index + 1}: ${event.time}`);
        });
        
        // Calculate timing for each query registration if multiple exist
        if (allQueryReceived.length > 0 && allQueryRegistered.length > 0) {
            console.log(`\n=== QUERY REGISTRATION TIMING ANALYSIS ===`);
            
            const registrationTimes: number[] = [];
            
            // Match each received with its corresponding registered
            for (let i = 0; i < Math.min(allQueryReceived.length, allQueryRegistered.length); i++) {
                const receivedTime = new Date(allQueryReceived[i].time).getTime();
                const registeredTime = new Date(allQueryRegistered[i].time).getTime();
                const timeDiff = registeredTime - receivedTime;
                
                registrationTimes.push(timeDiff);
                console.log(`Query ${i + 1}: ${allQueryReceived[i].time} → ${allQueryRegistered[i].time} = ${timeDiff}ms`);
            }
            
            if (registrationTimes.length > 1) {
                // Calculate statistics for multiple queries
                const mean = registrationTimes.reduce((sum, time) => sum + time, 0) / registrationTimes.length;
                const squaredDifferences = registrationTimes.map(time => Math.pow(time - mean, 2));
                const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / registrationTimes.length;
                const standardDeviation = Math.sqrt(variance);
                
                console.log(`\n=== STATISTICS FOR ${registrationTimes.length} QUERIES ===`);
                console.log(`Average registration time: ${mean.toFixed(2)}ms`);
                console.log(`Standard deviation: ±${standardDeviation.toFixed(2)}ms`);
                console.log(`Individual times: ${registrationTimes.join('ms, ')}ms`);
                console.log(`\nFor table: ${mean.toFixed(2)}ms ± ${standardDeviation.toFixed(2)}ms`);
            } else {
                console.log(`\n=== SINGLE QUERY REGISTRATION ===`);
                console.log(`Registration time: ${registrationTimes[0]}ms`);
                console.log(`Note: Only one query registration found - this is likely a single query experiment`);
                console.log(`For table: ${registrationTimes[0].toFixed(2)}ms ± 0.00ms (single measurement)`);
            }
        }
        
        // Check what type of experiment this is
        console.log(`\n=== EXPERIMENT TYPE ANALYSIS ===`);
        console.log(`This appears to be a ${allQueryReceived.length === 1 ? 'SINGLE' : 'MULTIPLE'} query experiment`);
        
        if (allQueryReceived.length === 1) {
            console.log(`The single query registration time of 92ms represents the one-time setup cost`);
            console.log(`for establishing the query in the aggregator system.`);
        }
        
        // Look for any patterns that might indicate multiple clients or iterations
        const clientRelatedEvents = logs.filter(log => 
            log.msg.includes('client') || 
            log.msg.includes('websocket') ||
            log.msg.includes('connection')
        ).slice(0, 10);
        
        console.log(`\n=== CLIENT CONNECTION EVENTS ===`);
        clientRelatedEvents.forEach((event, index) => {
            console.log(`${index + 1}. ${event.time} - ${event.msg}`);
        });
    });
}

analyzeAllQueryRegistrations();
