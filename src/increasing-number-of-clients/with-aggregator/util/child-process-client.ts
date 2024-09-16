import { WebSocket } from 'ws';
import * as fs from 'fs';
const ldes_acc_x = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
const ldes_acc_y = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/";
const ldes_acc_z = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/";
const location_of_aggregator = "http://n078-22.wall1.ilabt.imec.be:8080/";

const query = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX func: <http://extension.org/functions#> 
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js> 
REGISTER RStream <output> AS
SELECT (func:sqrt(?o * ?o + ?o2 * ?o2 + ?o3 * ?o3) AS ?activityIndex)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_acc_x}> [RANGE 60000 STEP 20000]
FROM NAMED WINDOW :w2 ON STREAM <${ldes_acc_y}> [RANGE 60000 STEP 20000]
FROM NAMED WINDOW :w3 ON STREAM <${ldes_acc_z}> [RANGE 60000 STEP 20000]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }
    WINDOW :w2 {
        ?s saref:hasValue ?o2 .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }   
    WINDOW :w3 {
        ?s saref:hasValue ?o3 .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .    
    }
}
`;

interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
}


function generateAggregatorClient(current_client_index: number): void {
    const logFile = `log-${current_client_index}.log`;
    fs.writeFileSync(logFile, `timestamp,cpu_user,cpu_system,rss,heapTotal,heapUsed,external\n`);
    const websocket = new WebSocket(location_of_aggregator, 'solid-stream-aggregator-protocol', {
        perMessageDeflate: false
    });

    function logCpuMemoryUsage() {
        const cpuUsage = process.cpuUsage();
        const memoryUsage: MemoryUsage = process.memoryUsage();
        const timestamp = Date.now();

        const logData = `${timestamp}, ${cpuUsage.user}, ${cpuUsage.system}, ${memoryUsage.rss}, ${memoryUsage.heapTotal}, ${memoryUsage.heapUsed}, ${memoryUsage.external}\n`;
        fs.appendFileSync(logFile, logData);
    }

    setInterval(() => {
        logCpuMemoryUsage
    }, 500);

    websocket.once('open', () => {
        const message = {
            query: query,
            type: 'live'
        };

        websocket.send(JSON.stringify(message));
    });

    websocket.on('message', (data: any) => {
        console.log(`Received data from aggregator: ${data.toString()}`);
    });

    websocket.on('close', () => {
        console.log('Connection closed');
    });

    websocket.on('error', (error: Error) => {
        console.error(`Error: ${error.message}`);
    });
}

process.on('message', async ({ current_client_index }) => {
    generateAggregatorClient(current_client_index);
});