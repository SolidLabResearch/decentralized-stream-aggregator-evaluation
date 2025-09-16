import * as fs from "fs";
import * as readline from "readline";

const logFile = "/Users/kushbisen/Downloads/1client/1/aggregator_logs/aggregator-2025-09-15-13-07-20.log";

interface LogEntry {
    msg: string;
    time: string;
}

async function countRSPEngineEvents() {
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
        
        // Count different event types
        const eventCounts = {
            webhook_notifications: 0,
            preprocessing_started: 0,
            preprocessing_completed: 0,
            added_to_rsp_engine: 0,
            aggregation_events_sent: 0,
            aggregation_events_received: 0
        };
        
        console.log("=== EVENT COUNTING ===");
        
        for (const log of logs) {
            switch (log.msg) {
                case 'webhook_notification_received':
                    eventCounts.webhook_notifications++;
                    break;
                case 'latest_event_received_preprocessing_started':
                    eventCounts.preprocessing_started++;
                    break;
                case 'latest_event_received_preprocessing_completed_adding_to_rsp_engine_started':
                    eventCounts.preprocessing_completed++;
                    break;
                case 'latest_event_added_to_rsp_engine':
                    eventCounts.added_to_rsp_engine++;
                    break;
                case 'aggregation_event_sent_to_solid_stream_aggregator_websocket_server':
                    eventCounts.aggregation_events_sent++;
                    break;
                case 'aggregation_event_received_now_publishing_to_client_ws':
                    eventCounts.aggregation_events_received++;
                    break;
            }
        }
        
        console.log(`Webhook notifications received: ${eventCounts.webhook_notifications}`);
        console.log(`Events started preprocessing: ${eventCounts.preprocessing_started}`);
        console.log(`Events completed preprocessing: ${eventCounts.preprocessing_completed}`);
        console.log(`Events added to RSP engine: ${eventCounts.added_to_rsp_engine}`);
        console.log(`Aggregation events sent: ${eventCounts.aggregation_events_sent}`);
        console.log(`Aggregation events received: ${eventCounts.aggregation_events_received}`);
        
        console.log(`\n=== ANALYSIS ===`);
        console.log(`GET requests (webhook → preprocessing): ${eventCounts.webhook_notifications > eventCounts.preprocessing_started ? eventCounts.preprocessing_started : eventCounts.webhook_notifications}`);
        console.log(`Successfully processed events: ${Math.min(eventCounts.preprocessing_started, eventCounts.added_to_rsp_engine)}`);
        console.log(`Processing efficiency: ${((eventCounts.added_to_rsp_engine / eventCounts.webhook_notifications) * 100).toFixed(1)}%`);
        
        // Show first and last few timestamps to understand duration
        console.log(`\n=== EXPERIMENT DURATION ===`);
        console.log(`First log entry: ${logs[0].time} - ${logs[0].msg}`);
        console.log(`Last log entry: ${logs[logs.length - 1].time} - ${logs[logs.length - 1].msg}`);
        
        const startTime = new Date(logs[0].time).getTime();
        const endTime = new Date(logs[logs.length - 1].time).getTime();
        const durationMs = endTime - startTime;
        const durationMinutes = (durationMs / 1000 / 60).toFixed(2);
        
        console.log(`Experiment duration: ${durationMs}ms (${durationMinutes} minutes)`);
        console.log(`Event processing rate: ${(eventCounts.added_to_rsp_engine / (durationMs / 1000)).toFixed(2)} events/second`);
    });
}

countRSPEngineEvents();
