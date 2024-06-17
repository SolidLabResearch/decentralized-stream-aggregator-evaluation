import { RSPEngine, RSPQLParser, RDFStream } from "rsp-js";
import { Literal } from "n3";
const N3 = require('n3');

const { DataFactory } = N3;
const { namedNode, defaultGraph, quad, literal } = DataFactory;
const ldes_location = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
const ldes_location2 = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/";
const ldes_location3 = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/";
const query3 = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX func: <http://extension.org/functions#> 
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/> 
REGISTER RStream <output> AS
SELECT (func:sqrt(?o * ?o + ?o2 * ?o2 + ?o3 * ?o3) AS ?activityIndex)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 80 STEP 200]
FROM NAMED WINDOW :w2 ON STREAM <${ldes_location2}> [RANGE 80 STEP 20]
FROM NAMED WINDOW :w3 ON STREAM <${ldes_location3}> [RANGE 80 STEP 20]
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

// SELECT ((func:pow(?o,2) + func:pow(?o2,2) + func:pow(?o3,2)) as ?activityIndex)

// SELECT (func:sqrt(func:pow(MAX(?o), 2) + func:pow(MAX(?o2), 2) + func:pow(MAX(?o3), 2)) as ?activityIndex)

function generate_data(num_events: number, rdfStreams: RDFStream[]) {
    for (let i = 0; i < num_events; i++) {

        rdfStreams.forEach((stream) => {
            const stream_element = quad(
                namedNode('https://rsp.js/test_subject_' + i),
                namedNode('https://saref.etsi.org/core/hasValue'),
                literal("80", namedNode('http://www.w3.org/2001/XMLSchema#integer')),
                defaultGraph(),
            );

            const stream_element2 = quad(
                namedNode('https://rsp.js/test_subject_' + i),
                namedNode('https://saref.etsi.org/core/relatesToProperty'),
                namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x'),
                defaultGraph(),
            );
            stream.add(stream_element, i);
            stream.add(stream_element2, i);
        });
    }
}

async function run() {
    const parser = new RSPQLParser();
    const parsed_query = parser.parse(query3);
    console.log(parsed_query.sparql);
    
    const rsp_engine = new RSPEngine(query3);
    let emitter = rsp_engine.register();
    let results = new Array<string>();

    const stream_x = await rsp_engine.getStream(ldes_location);
    const stream_y = await rsp_engine.getStream(ldes_location2);
    const stream_z = await rsp_engine.getStream(ldes_location3);

    if (stream_x && stream_y && stream_z) {
        const rdfStreams = [stream_x, stream_y, stream_z];
        generate_data(1000, rdfStreams);
    }

    emitter.on('RStream', (data: any) => {
        console.log(`Data is`, data.bindings.toString());
        results.push(data);
    });

    const sleep = (ms: any) => new Promise(r => setTimeout(r, ms));
    await sleep(2000);
    console.log(results);
}

run();