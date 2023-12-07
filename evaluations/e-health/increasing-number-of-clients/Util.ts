const WebSocket = require('ws');
import * as dotenv from 'dotenv';
import { record_usage } from '../increasing-window-sizes/Util';
import { sleep } from '@treecg/versionawareldesinldp';
dotenv.config();
let clients = 0;
const websocket_server = process.env.WEBSOCKET_SERVER;
const pod_location = process.env.POD_LOCATION;

export async function create_websocket_client(client_id: number) {
    const websocket = new WebSocket(`${websocket_server}`, 'solid-stream-aggregator-protocol', {
        perMessageDeflate: false
    });

    websocket.on('open', () => {
        console.log(`Client ${client_id} connected`);
        clients++;
        const query = {
            query: `
            PREFIX saref: <https://saref.etsi.org/core/>
            PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
            PREFIX : <https://rsp.js/>
            REGISTER RStream <output> AS
            SELECT (MAX(?o) as ?maxBVP)
            FROM NAMED WINDOW :w1 ON STREAM <${pod_location}> [RANGE 3600 STEP 20]
            WHERE {
                WINDOW :w1 {
                    ?s saref:hasValue ?o .
                    ?s saref:relatesToProperty dahccsensors:wearable.bvp .
                }
            }`,
            queryId: `query${client_id}`,
        };
        websocket.send(JSON.stringify(query));
    });

    websocket.on('message', (message: any) => {        
        const result = JSON.parse(message);
        console.log(`Client ${client_id} received: ${JSON.stringify(result)} | active clients: ${clients}`);
    });

    websocket.on('close', () => {
        clients--;
        console.log(`Client ${client_id} disconnected`);
    });
}

export async function create_websocket_clients(number_of_clients: number) {
    record_usage(`number-of-clients-${number_of_clients}`, `query-client-number-${number_of_clients}`, 1000)
    console.log(`Creating ${number_of_clients} clients`);
    for (let i = 0; i < number_of_clients; i++) {
        await create_websocket_client(i).then(() => {
            sleep(1000);
            console.log(`Client ${i} created`);
            
        });
    }
    console.log(`The number of clients which are working are`,clients);
    
}