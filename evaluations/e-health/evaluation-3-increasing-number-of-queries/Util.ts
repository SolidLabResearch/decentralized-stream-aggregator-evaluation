import WebSocket from "ws";

import * as dotenv from 'dotenv';
import { record_usage } from '../increasing-window-sizes/Util';
dotenv.config();

const websocket_server = process.env.WEBSOCKET_SERVER;
const pod_location = process.env.POD_LOCATION;

const base_query = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?maxBVP)
FROM NAMED WINDOW :w ON STREAM <${pod_location}> [RANGE 600 STEP 20]
WHERE {
    WINDOW :w {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.bvp .
    }
}
`;


export async function send_number_of_queries_to_the_aggregator(number_of_queries: number, websocket: WebSocket) {
    websocket.on('open', () => {
        for (let i = 1; i < number_of_queries; i++) {
            const modifiedQuery = base_query.replace(':w', `:w${i}`);
            const message_object = {
                query: modifiedQuery,
                queryId: `query_${i}`,
            };
            websocket.send(JSON.stringify(message_object));
        }
    });

    websocket.on('message', (message) => {
        let result = JSON.parse(message.toString());
        console.log(result.aggregation_event);
    });
}
