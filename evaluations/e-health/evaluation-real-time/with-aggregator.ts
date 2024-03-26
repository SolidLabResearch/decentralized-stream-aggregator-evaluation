import { WebSocket } from 'ws';

async function main() {

    const stream = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/";

    const websocket = new WebSocket('ws://n061-20b.wall2.ilabt.iminds.be:8080/', 'solid-stream-aggregator-protocol', {
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

main();