import { StreamProcessor } from "./StreamProcessor";
import { Instantiator } from "./Instantiator";
import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
import { RSPQLParser } from "rsp-js";
import * as http from 'http';
import * as WebSocket from 'ws';
let parser = new RSPQLParser();

let ldes_location = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/';
let query = `
    PREFIX saref: <https://saref.etsi.org/core/>
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (MAX(?o) as ?maxBVP)
    FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 1 STEP 1]
    WHERE {
        WINDOW :w1 {
            ?s saref:hasValue ?o .
            ?s saref:relatesToProperty dahccsensors:wearable.bvp .
        }   
    }
`;

// src/index.t

async function main() {

    const server = http.createServer();
    const wss = new WebSocket.Server({ noServer: true });

    wss.on('connection', (ws: WebSocket) => {
        console.log('Client connected');

        ws.on('message', (message: string) => {
            console.log(`Received: ${message}`);
            ws.send(`Server received: ${message}`);
        });

        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });

    server.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    });

    const PORT = 3001;
    let to_date = new Date("2023-11-15T09:47:09.8120Z");
    let window_width = parser.parse(query).s2r[0].width
    let from_date = new Date(to_date.getTime() - window_width * 1000);
    new Instantiator(query, from_date, to_date);
    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

main();