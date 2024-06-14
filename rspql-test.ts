import {RSPEngine, RSPQLParser} from "rsp-js";

const ldes_location = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
const ldes_location2 = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/";
const ldes_location3 = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/";

const query3 = `
PREFIX func: <http://extension.org/functions#> 
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (func:sqrt(func:pow(MAX(?o), 2) + func:pow(MAX(?o2), 2) + func:pow(MAX(?o3), 2)) as ?activityIndex)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 300000 STEP 60000]
FROM NAMED WINDOW :w2 ON STREAM <${ldes_location2}> [RANGE 300000 STEP 60000]   
FROM NAMED WINDOW :w3 ON STREAM <${ldes_location3}> [RANGE 300000 STEP 60000]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }
    WINDOW :w2 {
        ?s saref:hasValue ?o2 .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.y .
    }
    WINDOW :w3 {
        ?s saref:hasValue ?o3 .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.z .
    }
}
`;

async function run() {
    const parser = new RSPQLParser();
    const parsed_query = parser.parse(query3);
    console.log(parsed_query.sparql);
}

run();