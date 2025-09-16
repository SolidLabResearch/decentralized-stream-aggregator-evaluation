import * as fs from "fs";

// Read the CSV file and calculate GET request statistics
const csvContent = fs.readFileSync("/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/with-aggregator-analysis.csv", 'utf8');
const lines = csvContent.split('\n');

let totalWebhookNotifications = 0;
let totalGetRequestTime = 0;

// Count webhook notifications to calculate average
for (const line of lines) {
    if (line.includes('webhook_notification_received,webhook_notification_received')) {
        const parts = line.split(',');
        const count = parseInt(parts[3]);
        totalWebhookNotifications = count; // This gives us the total number of consecutive webhook pairs
    }
    
    if (line.includes('webhook_notification_received,latest_event_received_preprocessing_started')) {
        const parts = line.split(',');
        totalGetRequestTime = parseInt(parts[3]);
        break;
    }
}

// Calculate additional metrics from webhook_notification_received patterns
const webhookLines = lines.filter(line => line.includes('webhook_notification_received'));
console.log("\nWebhook-related timings from with-aggregator data:");
webhookLines.forEach(line => {
    const parts = line.split(',');
    if (parts.length >= 4) {
        console.log(`${parts[1]} → ${parts[2]}: ${parts[3]}ms total`);
    }
});

console.log(`\n=== GET REQUEST ANALYSIS ===`);
console.log(`Total cumulative GET request time: ${totalGetRequestTime}ms`);
console.log(`Total webhook notifications processed: ${totalWebhookNotifications}ms of webhook-to-webhook intervals`);

// Estimate number of events from the data
// The webhook_notification_received → latest_event_received_preprocessing_started total time
// divided by rough estimate from patterns we see
const estimatedEvents = Math.round(totalWebhookNotifications / 100); // Rough estimate
const averageGetTime = totalGetRequestTime / estimatedEvents;

console.log(`Estimated number of events: ~${estimatedEvents}`);
console.log(`Average GET request time per event: ~${averageGetTime.toFixed(2)}ms`);

console.log(`\n=== SUMMARY ===`);
console.log(`In the WITH-AGGREGATOR approach:`);
console.log(`- GET requests occur between webhook_notification_received and latest_event_received_preprocessing_started`);
console.log(`- Total GET time across all events: ${totalGetRequestTime}ms`);
console.log(`- This represents the time to fetch event data after receiving webhook notifications`);
