import * as fs from "fs";
import * as readline from "readline";

// First, let's create a mock log file to test your analysis logic
const mockLogFile = "/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/test-aggregation.log";

// Create mock log data to test your algorithm
const mockLogData = [
    { msg: "webhook_notification_received", time: "2025-09-16T10:00:00.000Z" },
    { msg: "event_fetch_started", time: "2025-09-16T10:00:00.010Z" },
    { msg: "event_fetch_completed", time: "2025-09-16T10:00:00.026Z" },
    { msg: "event_preprocessing_started", time: "2025-09-16T10:00:00.027Z" },
    { msg: "event_added_to_rsp_engine", time: "2025-09-16T10:00:00.028Z" },
    { msg: "webhook_notification_received", time: "2025-09-16T10:00:01.000Z" },
    { msg: "event_fetch_started", time: "2025-09-16T10:00:01.015Z" },
    { msg: "event_fetch_completed", time: "2025-09-16T10:00:01.031Z" },
    { msg: "event_preprocessing_started", time: "2025-09-16T10:00:01.032Z" },
    { msg: "event_added_to_rsp_engine", time: "2025-09-16T10:00:01.033Z" }
];

// Write mock data to file
const mockFileContent = mockLogData.map(entry => JSON.stringify(entry)).join('\n');
fs.writeFileSync(mockLogFile, mockFileContent);

console.log("Created mock log file with sample data");
console.log("Mock data represents:");
console.log("- webhook_notification_received → event_fetch_started: ~10-15ms");
console.log("- event_fetch_started → event_fetch_completed: ~16ms (GET request time)");
console.log("- event_fetch_completed → event_preprocessing_started: ~1ms");
console.log("- event_preprocessing_started → event_added_to_rsp_engine: ~1ms");

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

function processLogData(logfiepath: string, outputCSV: string) {
    const logs: LogEntry[] = [];
    const lineReader = readline.createInterface({
        input: fs.createReadStream(logfiepath),
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
        
        console.log(`\nProcessed ${logs.length} log entries`);
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

        console.log("\nTime differences between consecutive messages:");
        for (let entry of timeDiffData) {
            let message_one = entry.msg1;
            let message_two = entry.msg2;
            let time_diff = entry.time_diff_seconds;

            console.log(`${message_one} → ${message_two}: ${time_diff}ms`);

            const key = `${message_one},${message_two}`;
            if (cumulativeTimes.has(key)) {
                cumulativeTimes.set(key, cumulativeTimes.get(key)! + time_diff);
            }
            else {
                cumulativeTimes.set(key, time_diff);
            }
        }

        console.log("\nCumulative times for each message pair:");
        const records = Array.from(cumulativeTimes.entries()).map(([key, value]) => {
            const [msg1, msg2] = key.split(',');
            console.log(`${msg1} → ${msg2}: ${value}ms total`);
            return { msg1, msg2, time_diff_seconds: value };
        });

        // Write to CSV
        const csvContent = [
            'log_message1,log_message2,diff',
            ...records.map(r => `${r.msg1},${r.msg2},${r.time_diff_seconds}`)
        ].join('\n');
        
        fs.writeFileSync(outputCSV, csvContent);
        console.log(`\nCSV file written to: ${outputCSV}`);
    });
}

// Execute your analysis logic
processLogData(mockLogFile, "/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/test-output.csv");
