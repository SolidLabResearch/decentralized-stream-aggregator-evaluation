import { WebSocket } from 'ws';

export async function initializeAggregatorClients(number_of_clients: number, number_of_subscribed_streams: number) {
    const clients: Promise<any>[] = [];
    for (let i = 0; i < number_of_clients; i++) {
        clients.push(generate_aggregator_client());
    }
}

async function generate_aggregator_client() {
    const stream = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
    const location_of_aggregator = "http://n078-22.wall1.ilabt.imec.be:8080/";

    const websocket = new WebSocket('ws://localhost:8080/', 'solid-stream-aggregator-protocol', {
        perMessageDeflate: false
    });

    websocket.once('open', () => {
        let message = {
            query: `
            PREFIX saref: <https://saref.etsi.org/core/>
            PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
            PREFIX : <https://rsp.js/>
            REGISTER RStream <output> AS
            SELECT (MAX(?o) as ?maxSKT)
            FROM NAMED WINDOW :w1 ON STREAM <${stream}> [RANGE 300000 STEP 60000]
            WHERE {
                WINDOW :w1 {
                    ?s saref:hasValue ?o .
                    ?s saref:relatesToProperty dahccsensors:wearable.skt .
                }
            }
            `,
            type: `live`
        };

        websocket.send(JSON.stringify(message));
    });

    websocket.on('message', (data) => {
        console.log(data.toString());
    });
}