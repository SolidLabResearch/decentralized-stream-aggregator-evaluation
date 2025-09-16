import * as fs from "fs";
import * as readline from "readline";

const logFile = "/Users/kushbisen/Downloads/1client/1/aggregator_logs/aggregator-2025-09-15-13-07-20.log";

interface LogEntry {
    msg: string;
    time: string;
}

async function calculateSubscriptionTiming() {
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
        
        console.log("=== SUBSCRIPTION TIMING ANALYSIS ===");
        
        // Find relevant subscription events
        const subscriptionEvents: {[key: string]: LogEntry[]} = {
            'unique_query_registered': [],
            'subscription_to_ldes_stream_was_successful': [],
            'subscribing_to_ldes_stream_for_the_latest_events': []
        };
        
        // Collect all relevant events
        for (const log of logs) {
            if (subscriptionEvents[log.msg]) {
                subscriptionEvents[log.msg].push(log);
            }
        }
        
        console.log(`Query registrations found: ${subscriptionEvents['unique_query_registered'].length}`);
        console.log(`Stream subscriptions started: ${subscriptionEvents['subscribing_to_ldes_stream_for_the_latest_events'].length}`);
        console.log(`Successful subscriptions: ${subscriptionEvents['subscription_to_ldes_stream_was_successful'].length}`);
        
        // Calculate timing from query registered to subscription successful
        const subscriptionTimes: number[] = [];
        
        for (let i = 0; i < subscriptionEvents['unique_query_registered'].length; i++) {
            const queryRegistered = subscriptionEvents['unique_query_registered'][i];
            
            // Find the corresponding successful subscription
            // Look for the next successful subscription after this query registration
            const successfulSubscriptions = subscriptionEvents['subscription_to_ldes_stream_was_successful']
                .filter(sub => new Date(sub.time).getTime() > new Date(queryRegistered.time).getTime())
                .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
            
            if (successfulSubscriptions.length > 0) {
                const timeDiff = new Date(successfulSubscriptions[0].time).getTime() - new Date(queryRegistered.time).getTime();
                subscriptionTimes.push(timeDiff);
                
                console.log(`Stream ${i + 1}: Query registered at ${queryRegistered.time}, Subscription successful at ${successfulSubscriptions[0].time}, Duration: ${timeDiff}ms`);
            }
        }
        
        if (subscriptionTimes.length > 0) {
            const mean = subscriptionTimes.reduce((sum, time) => sum + time, 0) / subscriptionTimes.length;
            const squaredDifferences = subscriptionTimes.map(time => Math.pow(time - mean, 2));
            const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / subscriptionTimes.length;
            const standardDeviation = Math.sqrt(variance);
            const minTime = Math.min(...subscriptionTimes);
            const maxTime = Math.max(...subscriptionTimes);
            
            console.log(`\n=== SUBSCRIPTION STATISTICS ===`);
            console.log(`Number of streams subscribed: ${subscriptionTimes.length}`);
            console.log(`Average subscription time: ${mean.toFixed(2)}ms`);
            console.log(`Standard deviation: ±${standardDeviation.toFixed(2)}ms`);
            console.log(`Minimum: ${minTime}ms`);
            console.log(`Maximum: ${maxTime}ms`);
            console.log(`\nFormatted for table: ${mean.toFixed(2)}ms ± ${standardDeviation.toFixed(2)}ms`);
            
            // Individual stream times
            console.log(`\n=== INDIVIDUAL STREAM SUBSCRIPTION TIMES ===`);
            subscriptionTimes.forEach((time, index) => {
                console.log(`Stream ${index + 1}: ${time}ms`);
            });
        } else {
            console.log("\nNo matching subscription sequences found!");
        }
        
        // Let's also look at the raw sequence of events to understand the flow
        console.log(`\n=== EVENT SEQUENCE ANALYSIS ===`);
        const relevantEvents = logs.filter(log => 
            log.msg.includes('query') || 
            log.msg.includes('subscription') || 
            log.msg.includes('stream') ||
            log.msg.includes('subscribing')
        ).slice(0, 20); // First 20 relevant events
        
        relevantEvents.forEach((event, index) => {
            console.log(`${index + 1}. ${event.time} - ${event.msg}`);
        });
    });
}

calculateSubscriptionTiming();
