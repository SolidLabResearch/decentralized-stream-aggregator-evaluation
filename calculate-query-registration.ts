import * as fs from "fs";
import * as readline from "readline";

const logFile = "/Users/kushbisen/Downloads/1client/1/aggregator_logs/aggregator-2025-09-15-13-07-20.log";

interface LogEntry {
    msg: string;
    time: string;
}

async function calculateQueryRegistrationTiming() {
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
        
        console.log("=== QUERY REGISTRATION TIMING ANALYSIS ===");
        
        // Find query-related events
        const queryReceived = logs.find(log => log.msg === 'new_query_received_from_client_ws');
        const queryRegistered = logs.find(log => log.msg === 'unique_query_registered');
        const queryPreprocessingStarted = logs.find(log => log.msg === 'query_preprocessing_started');
        const queryPreprocessed = logs.find(log => log.msg === 'query_preprocessed');
        const queryIsUnique = logs.find(log => log.msg === 'query_is_unique');
        
        console.log(`Query received: ${queryReceived?.time}`);
        console.log(`Query preprocessing started: ${queryPreprocessingStarted?.time}`);
        console.log(`Query preprocessed: ${queryPreprocessed?.time}`);
        console.log(`Query is unique: ${queryIsUnique?.time}`);
        console.log(`Query registered: ${queryRegistered?.time}`);
        
        if (queryReceived && queryRegistered) {
            const queryReceivedTime = new Date(queryReceived.time).getTime();
            const queryRegisteredTime = new Date(queryRegistered.time).getTime();
            const totalRegistrationTime = queryRegisteredTime - queryReceivedTime;
            
            console.log(`\n=== QUERY REGISTRATION BREAKDOWN ===`);
            console.log(`Total time from query received to registered: ${totalRegistrationTime}ms`);
            
            // Calculate individual steps
            if (queryPreprocessingStarted) {
                const startProcessingTime = new Date(queryPreprocessingStarted.time).getTime() - queryReceivedTime;
                console.log(`Query received → preprocessing started: ${startProcessingTime}ms`);
            }
            
            if (queryPreprocessed && queryPreprocessingStarted) {
                const preprocessingTime = new Date(queryPreprocessed.time).getTime() - new Date(queryPreprocessingStarted.time).getTime();
                console.log(`Preprocessing duration: ${preprocessingTime}ms`);
            }
            
            if (queryIsUnique && queryPreprocessed) {
                const uniqueCheckTime = new Date(queryIsUnique.time).getTime() - new Date(queryPreprocessed.time).getTime();
                console.log(`Query preprocessed → query is unique: ${uniqueCheckTime}ms`);
            }
            
            if (queryRegistered && queryIsUnique) {
                const registrationTime = new Date(queryRegistered.time).getTime() - new Date(queryIsUnique.time).getTime();
                console.log(`Query is unique → query registered: ${registrationTime}ms`);
            }
            
            console.log(`\n=== FOR TABLE ===`);
            console.log(`Query Register: ${totalRegistrationTime.toFixed(2)}ms ± 0.00ms`);
            
        } else {
            console.log("Could not find both query received and query registered events");
        }
        
        // Show the detailed sequence for context
        console.log(`\n=== QUERY PROCESSING SEQUENCE ===`);
        const relevantLogs = logs.filter(log => 
            log.msg.includes('query') ||
            log.msg.includes('websocket_connection') ||
            log.msg.includes('isomorphic') ||
            log.msg.includes('unique') ||
            log.msg.includes('stream_processing')
        ).slice(0, 15);
        
        relevantLogs.forEach((log, index) => {
            const relativeTime = queryReceived ? 
                new Date(log.time).getTime() - new Date(queryReceived.time).getTime() : 0;
            console.log(`${index + 1}. +${relativeTime}ms: ${log.time} - ${log.msg}`);
        });
    });
}

calculateQueryRegistrationTiming();
