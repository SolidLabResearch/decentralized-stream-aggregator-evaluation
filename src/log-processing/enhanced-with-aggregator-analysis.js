const fs = require('fs');
const path = require('path');

// Enhanced analysis for with-aggregator approach with detailed timing metrics
function parseReplayerLogEnhanced(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    const events = [];
    let startTime = null;
    
    for (let line of lines) {
        const parts = line.split(',');
        if (parts[0] === 'start_replayer') {
            startTime = parseInt(parts[1]);
            continue;
        }
        
        if (parts.length >= 4) {
            const timestamp = parseInt(parts[0]);
            const eventNumber = parseInt(parts[1]);
            const url = parts[2];
            const rdfData = parts.slice(3).join(',');
            
            // Extract saref:hasTimestamp from RDF data
            const timestampMatch = rdfData.match(/saref:hasTimestamp>\s*"([^"]+)"/);
            const eventTimestamp = timestampMatch ? new Date(timestampMatch[1]) : null;
            
            events.push({
                clientTimestamp: timestamp,
                eventNumber,
                url,
                eventTimestamp,
                rdfData
            });
        }
    }
    
    return { startTime, events };
}

function parseAggregatorLogEnhanced(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    
    const timingEvents = {
        queryPreprocessing: [],
        eventPreprocessing: [],
        rspEngineAdd: [],
        queryExecution: [],
        eventPublishing: [],
        getRequests: []
    };
    
    let currentPreprocessingStart = null;
    let currentRspAddStart = null;
    let currentWebhookReceived = null;
    
    for (let line of lines) {
        try {
            const logEntry = JSON.parse(line);
            const timestamp = new Date(logEntry.time);
            
            switch (logEntry.msg) {
                case 'webhook_notification_received':
                    currentWebhookReceived = timestamp;
                    break;
                    
                case 'query_preprocessing_started':
                    timingEvents.queryPreprocessing.push({
                        type: 'start',
                        timestamp,
                        queryId: logEntry.query_id
                    });
                    break;
                    
                case 'query_preprocessed':
                    const preprocessStart = timingEvents.queryPreprocessing
                        .filter(e => e.type === 'start')
                        .pop();
                    if (preprocessStart) {
                        timingEvents.queryPreprocessing.push({
                            type: 'complete',
                            timestamp,
                            queryId: logEntry.query_id,
                            duration: timestamp - preprocessStart.timestamp
                        });
                    }
                    break;
                    
                case 'latest_event_received_preprocessing_started':
                    // Calculate GET request time (webhook received -> preprocessing started)
                    if (currentWebhookReceived) {
                        timingEvents.getRequests.push({
                            timestamp,
                            duration: timestamp - currentWebhookReceived
                        });
                    }
                    currentPreprocessingStart = timestamp;
                    currentWebhookReceived = null; // Reset for next event
                    break;
                    
                case 'latest_event_received_preprocessing_completed_adding_to_rsp_engine_started':
                    if (currentPreprocessingStart) {
                        timingEvents.eventPreprocessing.push({
                            timestamp,
                            duration: timestamp - currentPreprocessingStart
                        });
                        currentRspAddStart = timestamp;
                        currentPreprocessingStart = null;
                    }
                    break;
                    
                case 'latest_event_added_to_rsp_engine':
                    if (currentRspAddStart) {
                        timingEvents.rspEngineAdd.push({
                            timestamp,
                            duration: timestamp - currentRspAddStart
                        });
                        currentRspAddStart = null;
                    }
                    break;
                    
                case 'aggregation_event_sent_to_solid_stream_aggregator_websocket_server':
                    timingEvents.eventPublishing.push({
                        type: 'sent',
                        timestamp,
                        queryId: logEntry.query_id
                    });
                    break;
                    
                case 'aggregation_event_received_now_publishing_to_client_ws':
                    timingEvents.eventPublishing.push({
                        type: 'publishing',
                        timestamp,
                        queryId: logEntry.query_id
                    });
                    break;
            }
        } catch (e) {
            // Skip malformed JSON lines
            continue;
        }
    }
    
    return timingEvents;
}

function calculateOutOfOrderEvents(clientEvents, allowedDelayMs = 30000) {
    const sortedByEventTime = [...clientEvents]
        .filter(e => e.eventTimestamp)
        .sort((a, b) => a.eventTimestamp - b.eventTimestamp);
    
    const sortedByArrival = [...clientEvents]
        .filter(e => e.eventTimestamp)
        .sort((a, b) => a.clientTimestamp - b.clientTimestamp);
    
    let outOfOrderCount = 0;
    let totalWithTimestamps = sortedByEventTime.length;
    
    for (let i = 0; i < sortedByArrival.length; i++) {
        const event = sortedByArrival[i];
        const expectedPosition = sortedByEventTime.findIndex(e => 
            e.clientTimestamp === event.clientTimestamp
        );
        
        // Check if event arrived significantly out of order
        if (Math.abs(expectedPosition - i) > 0) {
            // Calculate if the delay exceeds the allowed threshold
            const arrivalTime = new Date(event.clientTimestamp);
            const eventTime = event.eventTimestamp;
            const delay = Math.abs(arrivalTime - eventTime);
            
            if (delay > allowedDelayMs) {
                outOfOrderCount++;
            }
        }
    }
    
    return {
        totalEvents: totalWithTimestamps,
        outOfOrderEvents: outOfOrderCount,
        outOfOrderPercentage: totalWithTimestamps > 0 ? (outOfOrderCount / totalWithTimestamps) * 100 : 0
    };
}

function calculateTimingStatistics(timingArray) {
    if (timingArray.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
    
    const durations = timingArray.map(t => t.duration).filter(d => d !== undefined);
    if (durations.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
    
    return {
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        count: durations.length
    };
}

function analyzeEnhancedWithAggregator() {
    const baseDir = '/Users/kushbisen/Downloads/1client';
    const outputDir = '/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/analysis-results/enhanced-with-aggregator-analysis';
    
    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const results = [];
    const detailedResults = [];
    
    console.log('Starting enhanced with-aggregator approach analysis...\n');
    console.log('Analyzing iterations 4-32 (30 iterations total, excluding first 3 and last 2)...\n');
    
    // Analyze each iteration (excluding first 3 and last 2)
    for (let iteration = 4; iteration <= 32; iteration++) {
        const iterationDir = path.join(baseDir, iteration.toString());
        
        if (!fs.existsSync(iterationDir)) continue;
        
        console.log(`Analyzing iteration ${iteration}...`);
        
        // Parse client data
        const replayerLogPath = path.join(iterationDir, 'replayer-log.csv');
        if (!fs.existsSync(replayerLogPath)) continue;
        
        const clientData = parseReplayerLogEnhanced(replayerLogPath);
        
        // Find aggregator logs
        const aggregatorLogsDir = path.join(iterationDir, 'aggregator_logs');
        if (!fs.existsSync(aggregatorLogsDir)) continue;
        
        const logFiles = fs.readdirSync(aggregatorLogsDir)
            .filter(f => f.endsWith('.log'))
            .map(f => {
                const filePath = path.join(aggregatorLogsDir, f);
                const stats = fs.statSync(filePath);
                return { name: f, path: filePath, size: stats.size };
            })
            .filter(f => f.size > 512) // Filter out small/incomplete files
            .sort((a, b) => b.size - a.size);
        
        if (logFiles.length === 0) continue;
        
        const selectedLogFile = logFiles[0];
        console.log(`  Selected log file: ${selectedLogFile.name} (${(selectedLogFile.size / 1024).toFixed(1)} KB)`);
        
        // Parse aggregator timing data
        const timingData = parseAggregatorLogEnhanced(selectedLogFile.path);
        
        // Calculate out-of-order events
        const oooAnalysis = calculateOutOfOrderEvents(clientData.events, 30000);
        
        // Calculate timing statistics
        const queryPreprocessingStats = calculateTimingStatistics(timingData.queryPreprocessing);
        const eventPreprocessingStats = calculateTimingStatistics(timingData.eventPreprocessing);
        const rspEngineAddStats = calculateTimingStatistics(timingData.rspEngineAdd);
        const getRequestStats = calculateTimingStatistics(timingData.getRequests);
        
        // Calculate query execution frequency
        const queryExecutionEvents = timingData.eventPublishing.filter(e => e.type === 'publishing');
        const queryExecutionRate = queryExecutionEvents.length;
        
        const result = {
            iteration,
            clientEvents: clientData.events.length,
            outOfOrderEvents: oooAnalysis.outOfOrderEvents,
            outOfOrderPercentage: oooAnalysis.outOfOrderPercentage.toFixed(2),
            queryPreprocessingAvg: queryPreprocessingStats.avg,
            queryPreprocessingCount: queryPreprocessingStats.count,
            getRequestAvg: getRequestStats.avg,
            getRequestMin: getRequestStats.min,
            getRequestMax: getRequestStats.max,
            getRequestCount: getRequestStats.count,
            eventPreprocessingAvg: eventPreprocessingStats.avg,
            eventPreprocessingMin: eventPreprocessingStats.min,
            eventPreprocessingMax: eventPreprocessingStats.max,
            eventPreprocessingCount: eventPreprocessingStats.count,
            rspEngineAddAvg: rspEngineAddStats.avg,
            rspEngineAddMin: rspEngineAddStats.min,
            rspEngineAddMax: rspEngineAddStats.max,
            rspEngineAddCount: rspEngineAddStats.count,
            queryExecutionRate
        };
        
        results.push(result);
        
        // Store detailed timing data for this iteration
        detailedResults.push({
            iteration,
            timingData,
            clientData: clientData.events,
            oooAnalysis
        });
        
        console.log(`  Client events: ${result.clientEvents}`);
        console.log(`  Out-of-order events: ${result.outOfOrderEvents} (${result.outOfOrderPercentage}%)`);
        console.log(`  GET request avg: ${result.getRequestAvg.toFixed(2)} ms`);
        console.log(`  Event preprocessing avg: ${result.eventPreprocessingAvg.toFixed(2)} ms`);
        console.log(`  RSP engine add avg: ${result.rspEngineAddAvg.toFixed(2)} ms`);
        console.log(`  Query executions: ${result.queryExecutionRate}`);
        console.log('');
    }
    
    // Save summary results
    const csvHeader = 'Iteration,Client_Events,Out_Of_Order_Events,Out_Of_Order_Percentage,Query_Preprocessing_Avg_ms,Query_Preprocessing_Count,GET_Request_Avg_ms,GET_Request_Min_ms,GET_Request_Max_ms,GET_Request_Count,Event_Preprocessing_Avg_ms,Event_Preprocessing_Min_ms,Event_Preprocessing_Max_ms,Event_Preprocessing_Count,RSP_Engine_Add_Avg_ms,RSP_Engine_Add_Min_ms,RSP_Engine_Add_Max_ms,RSP_Engine_Add_Count,Query_Execution_Rate\n';
    
    const csvContent = csvHeader + results.map(r => 
        `${r.iteration},${r.clientEvents},${r.outOfOrderEvents},${r.outOfOrderPercentage},${r.queryPreprocessingAvg.toFixed(2)},${r.queryPreprocessingCount},${r.getRequestAvg.toFixed(2)},${r.getRequestMin},${r.getRequestMax},${r.getRequestCount},${r.eventPreprocessingAvg.toFixed(2)},${r.eventPreprocessingMin},${r.eventPreprocessingMax},${r.eventPreprocessingCount},${r.rspEngineAddAvg.toFixed(2)},${r.rspEngineAddMin},${r.rspEngineAddMax},${r.rspEngineAddCount},${r.queryExecutionRate}`
    ).join('\n');
    
    const csvOutputPath = path.join(outputDir, 'enhanced-timing-analysis.csv');
    fs.writeFileSync(csvOutputPath, csvContent);
    
    // Calculate overall statistics
    const avgOutOfOrder = results.reduce((sum, r) => sum + parseFloat(r.outOfOrderPercentage), 0) / results.length;
    const avgGetRequest = results.reduce((sum, r) => sum + r.getRequestAvg, 0) / results.length;
    const avgEventPreprocessing = results.reduce((sum, r) => sum + r.eventPreprocessingAvg, 0) / results.length;
    const avgRspEngineAdd = results.reduce((sum, r) => sum + r.rspEngineAddAvg, 0) / results.length;
    const totalQueryExecutions = results.reduce((sum, r) => sum + r.queryExecutionRate, 0);
    
    console.log('================================================================================');
    console.log('ENHANCED WITH-AGGREGATOR TIMING ANALYSIS REPORT');
    console.log('================================================================================\n');
    console.log(`Analyzed Iterations: ${results.length}`);
    console.log(`Average Out-of-Order Events: ${avgOutOfOrder.toFixed(2)}%`);
    console.log(`Average GET Request Time: ${avgGetRequest.toFixed(2)} ms`);
    console.log(`Average Event Preprocessing Time: ${avgEventPreprocessing.toFixed(2)} ms`);
    console.log(`Average RSP Engine Add Time: ${avgRspEngineAdd.toFixed(2)} ms`);
    console.log(`Total Query Executions: ${totalQueryExecutions}`);
    console.log(`\nDetailed results saved to: ${csvOutputPath}`);
    console.log('================================================================================');
}

// Run the enhanced analysis
analyzeEnhancedWithAggregator();
