const { Cap, decoders } = require('cap');
const fs = require('fs');

// Ensure the log file exists
const logFile = 'http_requests.log';
fs.writeFileSync(logFile, '', { flag: 'w' });

// Counters for GET and POST requests
let getRequests = 0;
let postRequests = 0;

// A map to store incomplete HTTP requests by connection (src IP and port)
const connections = new Map();

// Timeout duration for incomplete requests (in milliseconds)
const REQUEST_TIMEOUT = 5000;

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
}

function handleTimeout(connKey) {
    const payload = connections.get(connKey);
    if (payload) {
        log(`Incomplete request for connection ${connKey}: ${payload}`);
        connections.delete(connKey);
    }
}

const c = new Cap();
const device = Cap.findDevice('localhost') || Cap.findDevice('127.0.0.1');
if (!device) {
    console.error('No suitable device found');
    process.exit(1);
}

const filter = 'tcp port 3000';
const bufSize = 10 * 1024 * 1024;
const buffer = Buffer.alloc(65535);

c.open(device, filter, bufSize, buffer);
c.setMinBytes && c.setMinBytes(0);

c.on('packet', (nbytes) => {
    const ret = decoders.Ethernet(buffer);

    if (ret.info.type === decoders.PROTOCOL.ETHERNET.IPV4) {
        const ip = decoders.IPV4(buffer, ret.offset);
        if (ip.info.protocol === decoders.PROTOCOL.IP.TCP) {
            const tcp = decoders.TCP(buffer, ip.offset);

            // Create a unique key for the connection
            const connKey = `${ip.info.srcaddr}:${tcp.info.srcport}-${ip.info.dstaddr}:${tcp.info.dstport}`;

            // Calculate the payload length
            const tcpHeaderLength = tcp.hdrlen;
            const ipHeaderLength = ip.hdrlen;
            const ipTotalLength = ip.info.totallen;
            const payloadLength = ipTotalLength - ipHeaderLength - tcpHeaderLength;

            // Extract the payload
            const payload = buffer.slice(tcp.offset + tcpHeaderLength, tcp.offset + tcpHeaderLength + payloadLength);
            const payloadString = payload.toString('utf-8');

            // Append the payload to the existing data for this connection
            if (!connections.has(connKey)) {
                connections.set(connKey, {
                    data: '',
                    timer: setTimeout(() => handleTimeout(connKey), REQUEST_TIMEOUT)
                });
            }
            const connectionData = connections.get(connKey);
            connectionData.data += payloadString;
            console.log(`payload string is `, payloadString);

            // Check if we have a complete HTTP request
            if (connectionData.data.includes('\r\n\r\n')) {
                const completeRequestIndex = connectionData.data.indexOf('\r\n\r\n');
                const completeRequest = connectionData.data.slice(0, completeRequestIndex + 4);
                if (completeRequest.startsWith('GET ')) {
                    getRequests += 1;
                    log(`GET request count: ${getRequests}`);
                } else if (completeRequest.startsWith('POST ')) {
                    postRequests += 1;
                    log(`POST request count: ${postRequests}`);
                }

                // Remove the processed connection and clear timeout
                clearTimeout(connectionData.timer);
                connections.delete(connKey);

                // Log for debugging
                console.log('Connection:', connKey);
                console.log('Payload (string):', completeRequest);

                // Process the complete HTTP request (e.g., log, forward to server, etc.)
                // ...
            }
        }
    }
});

console.log('Monitoring HTTP requests on port 3000...');
