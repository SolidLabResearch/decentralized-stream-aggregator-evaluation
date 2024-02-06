import {StreamProcessor} from "../StreamProcessor";

let ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/";

let query = `
    PREFIX saref: <https://saref.etsi.org/core/>
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (MIN(?o) as ?minSPO2)
    FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 86400000 STEP 600000]
    WHERE {
        WINDOW :w1 {
            ?s saref:hasValue ?o .
            ?s saref:relatesToProperty dahccsensors:org.dyamand.types.health.SpO2 .
        }   
    }
`;

let to_date = new Date("2023-11-24T10:24:05.000Z");
let from_date = new Date(to_date.getTime() - 86400000);

async function main() {
    new StreamProcessor(query, from_date, to_date);
}

main();