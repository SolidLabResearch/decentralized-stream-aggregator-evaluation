import { WebSocket } from 'ws';

const ldes_acc_x = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
const ldes_acc_y = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/";
const location_of_aggregator = "http://n078-22.wall1.ilabt.imec.be:8080/";
const ldes_acc_z = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/";
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

export async function initializeAggregatorClients(number_of_clients: number) {
    const clients: Promise<any>[] = [];
    for (let i = 0; i < number_of_clients; i++) {
        clients.push(generate_aggregator_client());
    }
    await Promise.all(clients);
}

async function generate_aggregator_client() {
    const websocket = new WebSocket(location_of_aggregator, 'solid-stream-aggregator-protocol', {
        perMessageDeflate: false
    });

    websocket.once('open', () => {
        let message = {
            query: query,
            type: `live`
        };

        websocket.send(JSON.stringify(message));
    });

    websocket.on('message', (data) => {
        console.log(data.toString());
    });

}