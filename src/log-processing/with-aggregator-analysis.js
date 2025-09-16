const fs = require('fs');
const path = require('path');

// Configuration
const BASE_LOCATION = '/Users/kushbisen/Downloads';
const CLIENT_COUNTS = [1]; // Starting with 1 client, can expand to [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const ITERATIONS = Array.from({length: 35}, (_, i) => i + 1);

/**
 * Parse replayer-log.csv to extract client-side performance metrics
 */
function parseReplayerLog(logFilePath) {
    if (!fs.existsSync(logFilePath)) {
        return null;
    }
    
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    let startTime = null;
    const events = [];
    
    for (const line of lines) {
        if (line.startsWith('start_replayer,')) {
            startTime = parseInt(line.split(',')[1]);
            continue;
        }
        
        // Parse event lines: timestamp,event_number,url,data
        const parts = line.split(',');
        if (parts.length >= 2) {
            const timestamp = parseInt(parts[0]);
            const eventNumber = parseInt(parts[1]);
            
            if (!isNaN(timestamp) && !isNaN(eventNumber)) {
                events.push({
                    timestamp: timestamp,
                    eventNumber: eventNumber,
                    relativeTime: startTime ? timestamp - startTime : 0
                });
            }
        }
    }
    
    return {
        startTime: startTime,
        events: events,
        duration: events.length > 0 ? events[events.length - 1].relativeTime : 0,
        eventCount: events.length
    };
}

/**
 * Parse aggregator resource usage CSV
 */
function parseAggregatorResourceUsage(logFilePath) {
    if (!fs.existsSync(logFilePath)) {
        return null;
    }
    
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return null; // No data
    
    const records = [];
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(part => part.trim());
        
        if (parts.length >= 6) {
            records.push({
                timestamp: parseInt(parts[0]),
                cpuUser: parseInt(parts[1]),
                rss: parseInt(parts[2]),
                heapTotal: parseInt(parts[3]),
                heapUsed: parseInt(parts[4]),
                external: parseInt(parts[5])
            });
        }
    }
    
    return records;
}

/**
 * Parse aggregator application log (JSON format)
 */
function parseAggregatorLog(logFilePath) {
    if (!fs.existsSync(logFilePath)) {
        return null;
    }
    
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    const events = [];
    
    for (const line of lines) {
        try {
            const logEntry = JSON.parse(line);
            events.push({
                timestamp: new Date(logEntry.time).getTime(),
                level: logEntry.level,
                message: logEntry.msg,
                queryId: logEntry.query_id || null,
                query: logEntry.query || null
            });
        } catch (e) {
            // Skip malformed JSON lines
            continue;
        }
    }
    
    return events;
}

/**
 * Analyze aggregator performance metrics
 */
function analyzeAggregatorPerformance(resourceRecords) {
    if (!resourceRecords || resourceRecords.length === 0) {
        return null;
    }
    
    // Calculate CPU usage (microseconds differences)
    const cpuUsages = [];
    for (let i = 1; i < resourceRecords.length; i++) {
        const timeDiff = resourceRecords[i].timestamp - resourceRecords[i-1].timestamp;
        const cpuDiff = resourceRecords[i].cpuUser - resourceRecords[i-1].cpuUser;
        
        if (timeDiff > 0) {
            const cpuPercentage = (cpuDiff / (timeDiff * 1000)) * 100; // Convert to percentage
            cpuUsages.push(cpuPercentage);
        }
    }
    
    // Memory metrics (convert bytes to MB)
    const rssValues = resourceRecords.map(r => r.rss / (1024 * 1024));
    const heapUsedValues = resourceRecords.map(r => r.heapUsed / (1024 * 1024));
    const heapTotalValues = resourceRecords.map(r => r.heapTotal / (1024 * 1024));
    
    return {
        cpu: {
            mean: calculateMean(cpuUsages),
            max: Math.max(...cpuUsages),
            min: Math.min(...cpuUsages),
            stdDev: calculateStdDev(cpuUsages)
        },
        memory: {
            rss: {
                mean: calculateMean(rssValues),
                max: Math.max(...rssValues),
                min: Math.min(...rssValues),
                stdDev: calculateStdDev(rssValues)
            },
            heapUsed: {
                mean: calculateMean(heapUsedValues),
                max: Math.max(...heapUsedValues),
                min: Math.min(...heapUsedValues),
                stdDev: calculateStdDev(heapUsedValues)
            },
            heapTotal: {
                mean: calculateMean(heapTotalValues),
                max: Math.max(...heapTotalValues),
                min: Math.min(...heapTotalValues),
                stdDev: calculateStdDev(heapTotalValues)
            }
        },
        duration: resourceRecords[resourceRecords.length - 1].timestamp - resourceRecords[0].timestamp,
        sampleCount: resourceRecords.length
    };
}

/**
 * Calculate basic statistics
 */
function calculateMean(values) {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
}

function calculateStdDev(values) {
    if (values.length <= 1) return 0;
    const mean = calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}

/**
 * Analyze query processing from aggregator logs
 */
function analyzeQueryProcessing(logEvents) {
    if (!logEvents || logEvents.length === 0) {
        return null;
    }
    
    const queryEvents = logEvents.filter(event => event.queryId);
    const queryTimelines = {};
    
    // Group events by query ID
    for (const event of queryEvents) {
        if (!queryTimelines[event.queryId]) {
            queryTimelines[event.queryId] = [];
        }
        queryTimelines[event.queryId].push(event);
    }
    
    const queryMetrics = [];
    
    for (const [queryId, events] of Object.entries(queryTimelines)) {
        events.sort((a, b) => a.timestamp - b.timestamp);
        
        const startEvent = events.find(e => e.message === 'query_preprocessing_started');
        const endEvent = events.find(e => e.message === 'query_preprocessed');
        
        if (startEvent && endEvent) {
            queryMetrics.push({
                queryId: queryId,
                preprocessingTime: endEvent.timestamp - startEvent.timestamp,
                eventCount: events.length
            });
        }
    }
    
    return {
        totalQueries: Object.keys(queryTimelines).length,
        queryMetrics: queryMetrics,
        avgPreprocessingTime: queryMetrics.length > 0 ? 
            calculateMean(queryMetrics.map(q => q.preprocessingTime)) : 0
    };
}

/**
 * Analyze a single iteration
 */
function analyzeIteration(clientNum, iteration) {
    const iterationDir = path.join(BASE_LOCATION, `${clientNum}client`, iteration.toString());
    
    console.log(`Analyzing ${clientNum} clients, iteration ${iteration}...`);
    
    // Parse client-side logs
    const replayerLogPath = path.join(iterationDir, 'replayer-log.csv');
    const replayerData = parseReplayerLog(replayerLogPath);
    
    // Find the main aggregator resource file (usually the largest one)
    const aggregatorLogsDir = path.join(iterationDir, 'aggregator_logs');
    if (!fs.existsSync(aggregatorLogsDir)) {
        console.log(`  No aggregator logs directory found`);
        return null;
    }
    
    const logFiles = fs.readdirSync(aggregatorLogsDir);
    const resourceFiles = logFiles.filter(f => f.startsWith('aggregator_resource_used-') && f.endsWith('.csv'));
    const appLogFiles = logFiles.filter(f => f.startsWith('aggregator-') && f.endsWith('.log'));
    
    // Find the largest resource file (main experiment) - prioritize by file size
    let mainResourceFile = null;
    let maxSize = 0;
    const MIN_RESOURCE_FILE_SIZE = 1024; // 1KB minimum - filter out tiny files
    
    console.log(`  Found ${resourceFiles.length} resource usage files:`);
    
    for (const file of resourceFiles) {
        const filePath = path.join(aggregatorLogsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`    ${file}: ${(stats.size / 1024).toFixed(1)} KB`);
        
        // Only consider files above minimum size threshold
        if (stats.size > maxSize && stats.size > MIN_RESOURCE_FILE_SIZE) {
            maxSize = stats.size;
            mainResourceFile = file;
        }
    }
    
    // Find the largest application log file
    let mainLogFile = null;
    let maxLogSize = 0;
    const MIN_LOG_FILE_SIZE = 512; // 512 bytes minimum
    
    console.log(`  Found ${appLogFiles.length} application log files:`);
    
    for (const file of appLogFiles) {
        const filePath = path.join(aggregatorLogsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`    ${file}: ${(stats.size / 1024).toFixed(1)} KB`);
        
        // Only consider files above minimum size threshold
        if (stats.size > maxLogSize && stats.size > MIN_LOG_FILE_SIZE) {
            maxLogSize = stats.size;
            mainLogFile = file;
        }
    }
    
    if (!mainResourceFile || !mainLogFile) {
        console.log(`  Missing main log files in iteration ${iteration}`);
        return null;
    }
    
    console.log(`  Selected resource file: ${mainResourceFile} (${(maxSize / 1024).toFixed(1)} KB)`);
    console.log(`  Selected log file: ${mainLogFile} (${(maxLogSize / 1024).toFixed(1)} KB)`);
    
    // Parse aggregator logs
    const resourcePath = path.join(aggregatorLogsDir, mainResourceFile);
    const logPath = path.join(aggregatorLogsDir, mainLogFile);
    
    const resourceData = parseAggregatorResourceUsage(resourcePath);
    const logData = parseAggregatorLog(logPath);
    
    if (!resourceData || !logData) {
        console.log(`  Failed to parse aggregator logs for iteration ${iteration}`);
        return null;
    }
    
    // Analyze performance
    const aggregatorPerformance = analyzeAggregatorPerformance(resourceData);
    const queryAnalysis = analyzeQueryProcessing(logData);
    
    console.log(`  Client events: ${replayerData ? replayerData.eventCount : 'N/A'}`);
    console.log(`  Aggregator CPU avg: ${aggregatorPerformance ? aggregatorPerformance.cpu.mean.toFixed(2) : 'N/A'}%`);
    console.log(`  Aggregator memory (RSS): ${aggregatorPerformance ? aggregatorPerformance.memory.rss.mean.toFixed(2) : 'N/A'} MB`);
    console.log(`  Query processing time: ${queryAnalysis ? queryAnalysis.avgPreprocessingTime.toFixed(2) : 'N/A'} ms`);
    
    return {
        clients: clientNum,
        iteration: iteration,
        clientData: replayerData,
        aggregatorPerformance: aggregatorPerformance,
        queryAnalysis: queryAnalysis,
        logFiles: {
            resourceFile: mainResourceFile,
            logFile: mainLogFile
        }
    };
}

/**
 * Generate detailed CSV output
 */
function generateDetailedCSV(results) {
    const headers = [
        'Clients', 'Iteration', 'Client_Events', 'Client_Duration_ms',
        'Aggregator_CPU_Mean_%', 'Aggregator_CPU_Max_%', 'Aggregator_CPU_StdDev_%',
        'Aggregator_RSS_Mean_MB', 'Aggregator_RSS_Max_MB', 'Aggregator_RSS_StdDev_MB',
        'Aggregator_HeapUsed_Mean_MB', 'Aggregator_HeapUsed_Max_MB', 'Aggregator_HeapUsed_StdDev_MB',
        'Query_Count', 'Avg_Query_Preprocessing_ms', 'Aggregator_Duration_ms'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    for (const result of results) {
        const row = [
            result.clients,
            result.iteration,
            result.clientData ? result.clientData.eventCount : 0,
            result.clientData ? result.clientData.duration : 0,
            result.aggregatorPerformance ? result.aggregatorPerformance.cpu.mean.toFixed(2) : 0,
            result.aggregatorPerformance ? result.aggregatorPerformance.cpu.max.toFixed(2) : 0,
            result.aggregatorPerformance ? result.aggregatorPerformance.cpu.stdDev.toFixed(2) : 0,
            result.aggregatorPerformance ? result.aggregatorPerformance.memory.rss.mean.toFixed(2) : 0,
            result.aggregatorPerformance ? result.aggregatorPerformance.memory.rss.max.toFixed(2) : 0,
            result.aggregatorPerformance ? result.aggregatorPerformance.memory.rss.stdDev.toFixed(2) : 0,
            result.aggregatorPerformance ? result.aggregatorPerformance.memory.heapUsed.mean.toFixed(2) : 0,
            result.aggregatorPerformance ? result.aggregatorPerformance.memory.heapUsed.max.toFixed(2) : 0,
            result.aggregatorPerformance ? result.aggregatorPerformance.memory.heapUsed.stdDev.toFixed(2) : 0,
            result.queryAnalysis ? result.queryAnalysis.totalQueries : 0,
            result.queryAnalysis ? result.queryAnalysis.avgPreprocessingTime.toFixed(2) : 0,
            result.aggregatorPerformance ? result.aggregatorPerformance.duration : 0
        ];
        
        csvContent += row.join(',') + '\n';
    }
    
    return csvContent;
}

/**
 * Generate summary statistics
 */
function generateSummaryStats(results) {
    const summaryByClients = {};
    
    // Group by client count
    for (const result of results) {
        if (!summaryByClients[result.clients]) {
            summaryByClients[result.clients] = [];
        }
        summaryByClients[result.clients].push(result);
    }
    
    const summaryStats = [];
    
    for (const [clientCount, iterations] of Object.entries(summaryByClients)) {
        const validIterations = iterations.filter(iter => 
            iter.aggregatorPerformance && iter.queryAnalysis && iter.clientData
        );
        
        if (validIterations.length === 0) continue;
        
        const cpuMeans = validIterations.map(iter => iter.aggregatorPerformance.cpu.mean);
        const rssMeans = validIterations.map(iter => iter.aggregatorPerformance.memory.rss.mean);
        const queryTimes = validIterations.map(iter => iter.queryAnalysis.avgPreprocessingTime);
        const eventCounts = validIterations.map(iter => iter.clientData.eventCount);
        
        summaryStats.push({
            clients: parseInt(clientCount),
            validIterations: validIterations.length,
            avgCpuUsage: calculateMean(cpuMeans),
            avgMemoryUsage: calculateMean(rssMeans),
            avgQueryProcessingTime: calculateMean(queryTimes),
            avgEventCount: calculateMean(eventCounts),
            cpuStdDev: calculateStdDev(cpuMeans),
            memoryStdDev: calculateStdDev(rssMeans)
        });
    }
    
    return summaryStats.sort((a, b) => a.clients - b.clients);
}

/**
 * Print analysis report
 */
function printAnalysisReport(summaryStats) {
    console.log('\n' + '='.repeat(80));
    console.log('WITH-AGGREGATOR APPROACH ANALYSIS REPORT');
    console.log('='.repeat(80));
    
    console.log('\nSUMMARY BY CLIENT COUNT:');
    console.log('-'.repeat(80));
    console.log('Clients | Valid Runs | Avg CPU% | Avg Memory MB | Avg Query Time ms | Avg Events');
    console.log('-'.repeat(80));
    
    for (const stat of summaryStats) {
        console.log(
            `${stat.clients.toString().padStart(7)} | ` +
            `${stat.validIterations.toString().padStart(10)} | ` +
            `${stat.avgCpuUsage.toFixed(1).padStart(8)} | ` +
            `${stat.avgMemoryUsage.toFixed(1).padStart(13)} | ` +
            `${stat.avgQueryProcessingTime.toFixed(1).padStart(17)} | ` +
            `${Math.round(stat.avgEventCount).toString().padStart(10)}`
        );
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80));
}

/**
 * Main analysis function
 */
function main() {
    try {
        console.log('Starting with-aggregator approach analysis...');
        
        const allResults = [];
        
        for (const clientNum of CLIENT_COUNTS) {
            console.log(`\nProcessing ${clientNum} client configuration...`);
            
            for (const iteration of ITERATIONS) {
                const result = analyzeIteration(clientNum, iteration);
                if (result) {
                    allResults.push(result);
                }
            }
        }
        
        if (allResults.length === 0) {
            console.error('No valid data found!');
            return 1;
        }
        
        // Create output directory
        const outputDir = path.join(__dirname, '../../analysis-results/with-aggregator-analysis');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Generate and save detailed CSV
        const detailedCSV = generateDetailedCSV(allResults);
        const detailedPath = path.join(outputDir, 'detailed-with-aggregator-analysis.csv');
        fs.writeFileSync(detailedPath, detailedCSV);
        console.log(`\nDetailed analysis saved to: ${detailedPath}`);
        
        // Generate summary statistics
        const summaryStats = generateSummaryStats(allResults);
        
        // Print analysis report
        printAnalysisReport(summaryStats);
        
        console.log(`\nAnalyzed ${allResults.length} iterations successfully.`);
        return 0;
        
    } catch (error) {
        console.error('Error during analysis:', error);
        return 1;
    }
}

// Run the analysis
if (require.main === module) {
    process.exit(main());
}

module.exports = {
    analyzeIteration,
    parseReplayerLog,
    parseAggregatorResourceUsage,
    parseAggregatorLog,
    analyzeAggregatorPerformance,
    analyzeQueryProcessing
};
