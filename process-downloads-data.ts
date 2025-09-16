import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const downloadsPath = "/Users/kushbisen/Downloads/1client";
const cumulativeTimes = new Map<string, number>();

interface LogEntry {
    msg: string;
    time: string;
}

interface TimeDiffData {
    msg1: string;
    msg2: string;
    time1: string;
    time2: string;
    time_diff_seconds: number;
}

function processLogData(logfilepath: string, outputCSV: string, approach: string) {
    console.log(`\nProcessing ${approach} data from: ${logfilepath}`);
    
    if (!fs.existsSync(logfilepath)) {
        console.log(`File not found: ${logfilepath}`);
        return;
    }
    
    const logs: LogEntry[] = [];
    const lineReader = readline.createInterface({
        input: fs.createReadStream(logfilepath),
    });

    lineReader.on('line', (line: string) => {
        try {
            const logEntry: LogEntry = JSON.parse(line);
            logs.push(logEntry);
        } catch (e) {
            console.log(`Error parsing line: ${line}`);
        }
    });

    lineReader.on('close', () => {
        logs.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        const timeDiffData: TimeDiffData[] = [];
        
        console.log(`Processed ${logs.length} log entries for ${approach}`);
        
        // Show first few entries to verify data
        console.log("First few entries:");
        logs.slice(0, 5).forEach((entry, i) => {
            console.log(`${i}: ${entry.time} - ${entry.msg}`);
        });
        
        for (let i = 1; i < logs.length; i++) {
            const time1 = new Date(logs[i - 1].time);
            const time2 = new Date(logs[i].time);
            const time_diff_seconds = (time2.getTime() - time1.getTime()); // milliseconds

            timeDiffData.push({
                msg1: logs[i - 1].msg,
                time1: logs[i - 1].time,
                msg2: logs[i].msg,
                time2: logs[i].time,
                time_diff_seconds: time_diff_seconds
            });
        }

        console.log(`\n${approach} - Time differences between consecutive messages:`);
        
        // Track GET request timing specifically
        let getTiming = 0;
        let getCount = 0;
        
        for (let entry of timeDiffData) {
            let message_one = entry.msg1;
            let message_two = entry.msg2;
            let time_diff = entry.time_diff_seconds;

            // Track GET request timing (event_fetch_started → event_fetch_completed)
            if (message_one === 'event_fetch_started' && message_two === 'event_fetch_completed') {
                getTiming += time_diff;
                getCount++;
                console.log(`GET REQUEST: ${message_one} → ${message_two}: ${time_diff}ms`);
            } else {
                console.log(`${message_one} → ${message_two}: ${time_diff}ms`);
            }

            const key = `${message_one},${message_two}`;
            if (cumulativeTimes.has(key)) {
                cumulativeTimes.set(key, cumulativeTimes.get(key)! + time_diff);
            } else {
                cumulativeTimes.set(key, time_diff);
            }
        }
        
        if (getCount > 0) {
            console.log(`\n${approach} - Average GET request time: ${getTiming / getCount}ms (${getCount} requests)`);
        } else {
            console.log(`\n${approach} - No GET requests found`);
        }

        console.log(`\n${approach} - Cumulative times for each message pair:`);
        const records = Array.from(cumulativeTimes.entries()).map(([key, value]) => {
            const [msg1, msg2] = key.split(',');
            console.log(`${msg1} → ${msg2}: ${value}ms total`);
            return { msg1, msg2, time_diff_seconds: value, approach };
        });

        // Write to CSV
        const csvContent = [
            'approach,log_message1,log_message2,diff',
            ...records.map(r => `${r.approach},${r.msg1},${r.msg2},${r.time_diff_seconds}`)
        ].join('\n');
        
        fs.writeFileSync(outputCSV, csvContent);
        console.log(`\n${approach} CSV file written to: ${outputCSV}`);
        
        // Clear cumulative times for next approach
        cumulativeTimes.clear();
    });
}

// Process the experimental data
console.log("Looking for aggregator log data in:", downloadsPath);

if (fs.existsSync(downloadsPath)) {
    const experimentDirs = fs.readdirSync(downloadsPath).filter(f => !f.startsWith('.'));
    console.log("Available experiment directories:", experimentDirs);
    
    // Process the first experiment directory (directory "1")
    const firstExperiment = path.join(downloadsPath, "1", "aggregator_logs");
    
    if (fs.existsSync(firstExperiment)) {
        const logFiles = fs.readdirSync(firstExperiment).filter(f => f.endsWith('.log'));
        console.log("Log files in experiment 1:", logFiles);
        
        // Find the largest log file (most likely the main experiment data)
        let largestLogFile = "";
        let largestSize = 0;
        
        for (const logFile of logFiles) {
            const fullPath = path.join(firstExperiment, logFile);
            const stats = fs.statSync(fullPath);
            if (stats.size > largestSize) {
                largestSize = stats.size;
                largestLogFile = fullPath;
            }
        }
        
        if (largestLogFile) {
            console.log(`Processing largest log file: ${largestLogFile} (${largestSize} bytes)`);
            processLogData(largestLogFile, "with-aggregator-analysis.csv", "with-aggregator");
        }
    } else {
        console.log(`Aggregator logs directory not found: ${firstExperiment}`);
    }
    
} else {
    console.log(`Downloads directory not found: ${downloadsPath}`);
    console.log("Please check the path or provide the correct location of your experimental data");
}
