import * as fs from "fs";
import * as readline from "readline";

const logFile = "/Users/kushbisen/Downloads/1client/1/aggregator_logs/aggregator-2025-09-15-13-07-20.log";

interface LogEntry {
    msg: string;
    time: string;
}

async function calculateDetailedSubscriptionTiming() {
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
        
        console.log("=== DETAILED SUBSCRIPTION TIMING ANALYSIS ===");
        
        // Find the query registration
        const queryRegistered = logs.find(log => log.msg === 'unique_query_registered');
        const subscribingEvents = logs.filter(log => log.msg === 'subscribing_to_ldes_stream_for_the_latest_events');
        const successfulSubscriptions = logs.filter(log => log.msg === 'subscription_to_ldes_stream_was_successful');
        
        console.log(`Query registered at: ${queryRegistered?.time}`);
        console.log(`Number of subscribing events: ${subscribingEvents.length}`);
        console.log(`Number of successful subscriptions: ${successfulSubscriptions.length}`);
        
        if (queryRegistered && successfulSubscriptions.length === 3) {
            const queryTime = new Date(queryRegistered.time).getTime();
            const subscriptionTimes: number[] = [];
            
            console.log(`\n=== INDIVIDUAL STREAM SUBSCRIPTION TIMINGS ===`);
            
            successfulSubscriptions.forEach((subscription, index) => {
                const subscriptionTime = new Date(subscription.time).getTime();
                const timeDiff = subscriptionTime - queryTime;
                subscriptionTimes.push(timeDiff);
                
                console.log(`Stream ${index + 1}:`);
                console.log(`  - Query registered: ${queryRegistered.time}`);
                console.log(`  - Subscription successful: ${subscription.time}`);
                console.log(`  - Duration: ${timeDiff}ms`);
            });
            
            // Calculate statistics
            const mean = subscriptionTimes.reduce((sum, time) => sum + time, 0) / subscriptionTimes.length;
            const squaredDifferences = subscriptionTimes.map(time => Math.pow(time - mean, 2));
            const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / subscriptionTimes.length;
            const standardDeviation = Math.sqrt(variance);
            const minTime = Math.min(...subscriptionTimes);
            const maxTime = Math.max(...subscriptionTimes);
            
            console.log(`\n=== SUBSCRIPTION STATISTICS (3 STREAMS) ===`);
            console.log(`Stream 1 subscription time: ${subscriptionTimes[0]}ms`);
            console.log(`Stream 2 subscription time: ${subscriptionTimes[1]}ms`);
            console.log(`Stream 3 subscription time: ${subscriptionTimes[2]}ms`);
            console.log(`Average subscription time: ${mean.toFixed(2)}ms`);
            console.log(`Standard deviation: ±${standardDeviation.toFixed(2)}ms`);
            console.log(`Minimum: ${minTime}ms`);
            console.log(`Maximum: ${maxTime}ms`);
            console.log(`Range: ${maxTime - minTime}ms`);
            
            console.log(`\n=== FOR TABLE ===`);
            console.log(`Subscribing Stream: ${mean.toFixed(2)}ms ± ${standardDeviation.toFixed(2)}ms`);
            
            // Show the time between each subscription completion
            console.log(`\n=== SUBSCRIPTION COMPLETION INTERVALS ===`);
            for (let i = 1; i < subscriptionTimes.length; i++) {
                const interval = subscriptionTimes[i] - subscriptionTimes[i-1];
                console.log(`Time between stream ${i} and stream ${i+1} completion: ${interval}ms`);
            }
            
        } else {
            console.log("Could not find the expected query registration and 3 successful subscriptions");
        }
        
        // Show the detailed sequence for context
        console.log(`\n=== SUBSCRIPTION SEQUENCE DETAIL ===`);
        const relevantLogs = logs.filter(log => 
            log.msg === 'unique_query_registered' ||
            log.msg === 'subscribing_to_ldes_stream_for_the_latest_events' ||
            log.msg === 'subscription_to_ldes_stream_was_successful'
        );
        
        relevantLogs.forEach((log, index) => {
            console.log(`${index + 1}. ${log.time} - ${log.msg}`);
        });
    });
}

calculateDetailedSubscriptionTiming();
