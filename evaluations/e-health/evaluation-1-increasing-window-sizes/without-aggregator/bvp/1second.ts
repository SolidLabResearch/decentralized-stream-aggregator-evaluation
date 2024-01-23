import { StreamProcessor } from "./StreamProcessor";

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

let to_date = new Date("2023-11-15T09:47:09.8120Z");
let from_date = new Date(to_date.getTime() - 1000);

async function main() {
    new StreamProcessor(query, from_date, to_date);
}

main();