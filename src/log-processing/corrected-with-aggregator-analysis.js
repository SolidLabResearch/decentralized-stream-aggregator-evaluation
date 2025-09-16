const fs = require('fs');
const path = require('path');

// Enhanced analysis that correctly handles webhook-preprocessing pairing
function parseAggregatorLogCorrected(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const webhookNotifications = [];
    const preprocessingEvents = [];
    const rspEngineEvents = [];
    const queryEvents = [];
    
    lines.forEach(line => {
        if (line.includes('webhook ntoficiation recerived')) {
            const match = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
            if (match) {
                webhookNotifications.push(new Date(match[1]));
            }
        } else if (line.includes('latest_event_received_preprocessing_started')) {
            const match = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
            if (match) {
                preprocessingEvents.push(new Date(match[1]));
            }
        } else if (line.includes('event_added_to_RSP_engine')) {
            const match = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
            if (match) {
                rspEngineEvents.push(new Date(match[1]));
            }
        } else if (line.includes('Query executed')) {
            const match = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
            if (match) {
                queryEvents.push(new Date(match[1]));
            }
        }
    });
    
    return {
        webhookNotifications,
        preprocessingEvents,
        rspEngineEvents,
        queryEvents
    };
}

// Sequential pairing logic: first webhook -> first preprocessing, second webhook -> second preprocessing, etc.
function calculateCorrectedTimings(events) {
    const { webhookNotifications, preprocessingEvents, rspEngineEvents } = events;
    
    const getRequestTimes = [];
    const preprocessingTimes = [];
    const rspEngineTimes = [];
    let preprocessingWithoutWebhook = 0;
    
    // Sort events by timestamp to ensure proper order
    const sortedWebhooks = [...webhookNotifications].sort((a, b) => a - b);
    const sortedPreprocessing = [...preprocessingEvents].sort((a, b) => a - b);
    const sortedRspEngine = [...rspEngineEvents].sort((a, b) => a - b);
    
    // Sequential pairing: match webhooks to preprocessing events in order
    const minLength = Math.min(sortedWebhooks.length, sortedPreprocessing.length);
    
    for (let i = 0; i < minLength; i++) {
        // Calculate GET request time (webhook to preprocessing)
        const getTime = sortedPreprocessing[i] - sortedWebhooks[i];
        if (getTime >= 0) { // Only include positive times (webhook before preprocessing)
            getRequestTimes.push(getTime);
        }
        
        // Calculate preprocessing time (preprocessing to RSP engine)
        if (sortedRspEngine[i]) {
            const prepTime = sortedRspEngine[i] - sortedPreprocessing[i];
            if (prepTime >= 0) {
                preprocessingTimes.push(prepTime);
            }
        }
        
        // Calculate RSP engine add time (between consecutive RSP events)
        if (i > 0 && sortedRspEngine[i] && sortedRspEngine[i - 1]) {
            const rspTime = sortedRspEngine[i] - sortedRspEngine[i - 1];
            if (rspTime >= 0) {
                rspEngineTimes.push(rspTime);
            }
        }
    }
    
    // Count preprocessing events without matching webhooks
    preprocessingWithoutWebhook = Math.max(0, sortedPreprocessing.length - sortedWebhooks.length);
    
    return {
        getRequestTimes,
        preprocessingTimes,
        rspEngineTimes,
        preprocessingWithoutWebhook,
        totalPreprocessingEvents: sortedPreprocessing.length,
        totalWebhookEvents: sortedWebhooks.length
    };
}

function calculateOutOfOrderEventsCorrected(events) {
    const { preprocessingEvents } = events;
    const allowedDelay = 30000; // 30 seconds
    let outOfOrderCount = 0;
    
    // Sort preprocessing events to check order
    const sortedEvents = [...preprocessingEvents].sort((a, b) => a - b);
    
    for (let i = 1; i < sortedEvents.length; i++) {
        const timeDiff = sortedEvents[i] - sortedEvents[i - 1];
        if (timeDiff < -allowedDelay) {
            outOfOrderCount++;
        }
    }
    
    return {
        outOfOrderCount,
        totalEvents: sortedEvents.length,
        percentage: (outOfOrderCount / sortedEvents.length) * 100
    };
}

function calculateStats(times) {
    if (times.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
    
    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    return { avg, min, max, count: times.length };
}

// Main analysis function
function analyzeWithAggregatorCorrected() {
    console.log('Corrected With-Aggregator Analysis (4Hz, 1-client)\n');
    
    const baseDir = '/Users/kushbisen/Downloads/1client';
    
    let allResults = [];
    
    // Process iterations 4-32 (30 iterations)
    for (let iteration = 4; iteration <= 32; iteration++) {
        const iterationDir = path.join(baseDir, iteration.toString());
        
        if (!fs.existsSync(iterationDir)) continue;
        
        const files = fs.readdirSync(iterationDir)
            .filter(file => file.endsWith('.log'))
            .map(file => ({
                name: file,
                size: fs.statSync(path.join(iterationDir, file)).size
            }))
            .sort((a, b) => b.size - a.size);
        
        if (files.length === 0) continue;
        
        const logFile = path.join(iterationDir, files[0].name);
        const events = parseAggregatorLogCorrected(logFile);
        const timings = calculateCorrectedTimings(events);
        const outOfOrder = calculateOutOfOrderEventsCorrected(events);
        
        allResults.push({
            iteration,
            timings,
            outOfOrder,
            events
        });
        
        console.log(`Iteration ${iteration}: ${events.preprocessingEvents.length} preprocessing, ${events.webhookNotifications.length} webhooks, ${timings.preprocessingWithoutWebhook} without webhook, ${timings.getRequestTimes.length} valid GET timings`);
    }
    
    // Aggregate statistics
    const allGetTimes = allResults.flatMap(r => r.timings.getRequestTimes);
    const allPrepTimes = allResults.flatMap(r => r.timings.preprocessingTimes);
    const allRspTimes = allResults.flatMap(r => r.timings.rspEngineTimes);
    const allQueryCounts = allResults.map(r => r.events.queryEvents.length);
    
    const totalOutOfOrder = allResults.reduce((sum, r) => sum + r.outOfOrder.outOfOrderCount, 0);
    const totalEvents = allResults.reduce((sum, r) => sum + r.outOfOrder.totalEvents, 0);
    const totalPreprocessingWithoutWebhook = allResults.reduce((sum, r) => sum + r.timings.preprocessingWithoutWebhook, 0);
    const totalWebhookEvents = allResults.reduce((sum, r) => sum + r.timings.totalWebhookEvents, 0);
    const totalPreprocessingEvents = allResults.reduce((sum, r) => sum + r.timings.totalPreprocessingEvents, 0);
    
    console.log('\n=== CORRECTED ANALYSIS RESULTS ===\n');
    
    // GET Request Statistics (corrected)
    const getStats = calculateStats(allGetTimes);
    console.log('GET Request Time:');
    console.log(`  Average: ${getStats.avg.toFixed(2)} ms`);
    console.log(`  Min: ${getStats.min.toFixed(2)} ms`);
    console.log(`  Max: ${getStats.max.toFixed(2)} ms`);
    console.log(`  Valid measurements: ${getStats.count} out of ${totalPreprocessingEvents}`);
    console.log(`  Events without webhook: ${totalPreprocessingWithoutWebhook}`);
    
    // Preprocessing Statistics
    const prepStats = calculateStats(allPrepTimes);
    console.log('\nPreprocessing Time:');
    console.log(`  Average: ${prepStats.avg.toFixed(2)} ms`);
    console.log(`  Min: ${prepStats.min.toFixed(2)} ms`);
    console.log(`  Max: ${prepStats.max.toFixed(2)} ms`);
    
    // RSP Engine Statistics
    const rspStats = calculateStats(allRspTimes);
    console.log('\nRSP Engine Add Time:');
    console.log(`  Average: ${rspStats.avg.toFixed(2)} ms`);
    console.log(`  Min: ${rspStats.min.toFixed(2)} ms`);
    console.log(`  Max: ${rspStats.max.toFixed(2)} ms`);
    
    // Query Statistics
    const avgQueries = allQueryCounts.reduce((sum, count) => sum + count, 0) / allQueryCounts.length;
    console.log('\nQuery Execution:');
    console.log(`  Average queries per iteration: ${avgQueries.toFixed(2)}`);
    console.log(`  Total queries across all iterations: ${allQueryCounts.reduce((sum, count) => sum + count, 0)}`);
    
    // Out of Order Statistics
    console.log('\nOut of Order Events:');
    console.log(`  Total out of order: ${totalOutOfOrder}`);
    console.log(`  Total events: ${totalEvents}`);
    console.log(`  Percentage: ${((totalOutOfOrder / totalEvents) * 100).toFixed(2)}%`);
    
    // Summary Statistics
    console.log('\nSummary:');
    console.log(`  Total webhook notifications: ${totalWebhookEvents}`);
    console.log(`  Total preprocessing events: ${totalPreprocessingEvents}`);
    console.log(`  Events with valid GET timing: ${getStats.count}`);
    console.log(`  Events without webhook: ${totalPreprocessingWithoutWebhook}`);
    console.log(`  Webhook utilization: ${((getStats.count / totalWebhookEvents) * 100).toFixed(2)}%`);
    
    // Export corrected data
    const csvData = allResults.map(result => {
        const getStats = calculateStats(result.timings.getRequestTimes);
        const prepStats = calculateStats(result.timings.preprocessingTimes);
        const rspStats = calculateStats(result.timings.rspEngineTimes);
        
        return {
            iteration: result.iteration,
            get_request_avg: getStats.avg.toFixed(2),
            get_request_count: getStats.count,
            preprocessing_avg: prepStats.avg.toFixed(2),
            rsp_engine_avg: rspStats.avg.toFixed(2),
            query_count: result.events.queryEvents.length,
            out_of_order_count: result.outOfOrder.outOfOrderCount,
            out_of_order_percentage: result.outOfOrder.percentage.toFixed(2),
            events_without_webhook: result.timings.preprocessingWithoutWebhook,
            total_preprocessing: result.timings.totalPreprocessingEvents,
            total_webhooks: result.timings.totalWebhookEvents
        };
    });
    
    if (csvData.length > 0) {
        const csvHeader = Object.keys(csvData[0]).join(',');
        const csvRows = csvData.map(row => Object.values(row).join(','));
        const csvContent = [csvHeader, ...csvRows].join('\n');
        
        fs.writeFileSync('/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/src/log-processing/corrected-timing-analysis.csv', csvContent);
        console.log('\nCorrected data exported to: corrected-timing-analysis.csv');
    } else {
        console.log('\nNo data to export - no results found');
    }
}

// Run the corrected analysis
analyzeWithAggregatorCorrected();
