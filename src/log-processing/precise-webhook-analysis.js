// More precise webhook-to-preprocessing mapping analysis
const fs = require('fs');

function analyzeWebhookProcessingPattern(logFilePath) {
    const content = fs.readFileSync(logFilePath, 'utf8');
    const lines = content.trim().split('\n');
    
    const events = [];
    let webhookQueue = [];
    
    for (let line of lines) {
        try {
            const logEntry = JSON.parse(line);
            const timestamp = new Date(logEntry.time);
            
            if (logEntry.msg === 'webhook_notification_received') {
                webhookQueue.push(timestamp);
            } else if (logEntry.msg === 'latest_event_received_preprocessing_started') {
                if (webhookQueue.length > 0) {
                    // Use the most recent webhook (last in queue)
                    const webhookTime = webhookQueue[webhookQueue.length - 1];
                    const getRequestTime = timestamp - webhookTime;
                    
                    events.push({
                        webhookTime,
                        preprocessingTime: timestamp,
                        getRequestDuration: getRequestTime,
                        queuedWebhooks: webhookQueue.length
                    });
                    
                    // Clear the queue after processing
                    webhookQueue = [];
                } else {
                    console.log(`Warning: Preprocessing without webhook at ${timestamp}`);
                }
            }
        } catch (e) {
            continue;
        }
    }
    
    return events;
}

// Analyze iteration 32
const events = analyzeWebhookProcessingPattern('/Users/kushbisen/Downloads/1client/32/aggregator_logs/aggregator-2025-09-15-19-34-32.log');

console.log(`Total webhook->preprocessing pairs: ${events.length}`);
console.log(`Events with multiple queued webhooks: ${events.filter(e => e.queuedWebhooks > 1).length}`);

const getRequestTimes = events.map(e => e.getRequestDuration);
const avgGetTime = getRequestTimes.reduce((a, b) => a + b, 0) / getRequestTimes.length;
const minGetTime = Math.min(...getRequestTimes);
const maxGetTime = Math.max(...getRequestTimes);

console.log(`GET request timing:`);
console.log(`  Average: ${avgGetTime.toFixed(2)} ms`);
console.log(`  Min: ${minGetTime} ms`);
console.log(`  Max: ${maxGetTime} ms`);

// Show queue distribution
const queueCounts = {};
events.forEach(e => {
    queueCounts[e.queuedWebhooks] = (queueCounts[e.queuedWebhooks] || 0) + 1;
});

console.log(`\nWebhook queue distribution:`);
Object.keys(queueCounts).sort((a, b) => parseInt(a) - parseInt(b)).forEach(count => {
    console.log(`  ${count} webhook(s): ${queueCounts[count]} events`);
});

// Show some examples
console.log(`\nFirst 10 events:`);
events.slice(0, 10).forEach((e, i) => {
    console.log(`  ${i+1}: ${e.queuedWebhooks} webhooks, ${e.getRequestDuration}ms GET time`);
});
