import { RSPQLParser } from 'rsp-js';

const ldes_acc_x = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
const ldes_acc_y = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/";
const ldes_acc_z = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/";

const query = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX func: <http://extension.org/functions#>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js>
PREFIX pod: <http://n078-03.wall1.ilabt.imec.be:3000/pod1/>
REGISTER RStream <output> AS
SELECT (func:sqrt(?o * ?o + ?o2 * ?o2 + ?o3 * ?o3) AS ?activityIndex)
FROM NAMED WINDOW pod:acc-x ON STREAM <${ldes_acc_x}> [RANGE 60000 STEP 20000]
FROM NAMED WINDOW pod:acc-y ON STREAM <${ldes_acc_y}> [RANGE 60000 STEP 20000]
FROM NAMED WINDOW pod:acc-z ON STREAM <${ldes_acc_z}> [RANGE 60000 STEP 20000]
WHERE {
    WINDOW pod:acc-x {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }
    WINDOW pod:acc-y {
        ?s saref:hasValue ?o2 .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }
    WINDOW pod:acc-z {
        ?s saref:hasValue ?o3 .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }
}
`;

let rspql_parser = new RSPQLParser();
let parsed_query = rspql_parser.parse(query);

console.log(parsed_query.sparql);

