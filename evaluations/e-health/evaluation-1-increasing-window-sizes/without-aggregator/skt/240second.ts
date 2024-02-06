import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp"
import { StreamProcessor } from "../StreamProcessor";

let ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/";
let query = `
    PREFIX saref: <https://saref.etsi.org/core/>
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (MAX(?o) as ?maxSKT)
    FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 240000 STEP 60000]
    WHERE {
        WINDOW :w1 {
            ?s saref:hasValue ?o .
            ?s saref:relatesToProperty dahccsensors:wearable.skt .
        }   
    }
`;

let to_date = new Date("2024-02-01T17:54:03.025Z");
let from_date = new Date(to_date.getTime() - 240000);

async function main() {
    new StreamProcessor(query, from_date, to_date);
}

main();