import { ExperimentConfig } from "./config";

/** The canonical 4 Hz query, copied verbatim in meaning from the three 4 Hz entrypoint implementations. */
export function buildActivityIndexQuery(streams: ExperimentConfig["streams"]): string {
    return `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX func: <http://extension.org/functions#> 
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/> 
REGISTER RStream <output> AS
SELECT (func:sqrt(?o * ?o + ?o2 * ?o2 + ?o3 * ?o3) AS ?activityIndex)
FROM NAMED WINDOW :w1 ON STREAM <${streams.x}> [RANGE 60000 STEP 20000]
FROM NAMED WINDOW :w2 ON STREAM <${streams.y}> [RANGE 60000 STEP 20000]
FROM NAMED WINDOW :w3 ON STREAM <${streams.z}> [RANGE 60000 STEP 20000]
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
}
