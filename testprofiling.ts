import * as bunyan from 'bunyan';
import * as fs from 'fs';

// Create a writable stream to the log file
const logFile = fs.createWriteStream('app.log', { flags: 'a' });

// Create a Bunyan logger instance
const logger = bunyan.createLogger({
    name: 'app',
    streams: [
        { level: 'info', stream: logFile }, // Log to file
    ],
    serializers: {
        // Add a custom serializer for the log message
        log: (logData: any) => {
            return {
                ...logData,
                queryId: logData.queryId || 'N/A', // Ensure queryId is present or set to 'N/A'
            };
        },
    },
});

function processQuery(query: string, queryId: string) {
    if (query === 'error') {
        logger.error({ queryId }, 'This is an error log');
    } else if (query === 'warning') {
        logger.warn({ queryId }, 'This is a warning log');
    } else if (query === 'info') {
        logger.info({ queryId }, 'This is an info log');
    } else {
        logger.debug({ queryId }, 'This is a debug log');
    }
}

// Example usage
processQuery('error', 'query1'); // Outputs an error log with Query ID: query1 to app.log file
