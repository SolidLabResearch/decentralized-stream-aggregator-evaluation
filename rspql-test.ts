import { RSPEngine, RSPQLParser, RDFStream } from "rsp-js";
import { Literal } from "n3";
const N3 = require('n3');
// SELECT (func:sqrt(?o * ?o + ?o2 * ?o2 + ?o3 * ?o3) AS ?activityIndex)
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
SELECT ?o
FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 60000 STEP 20000]
FROM NAMED WINDOW :w2 ON STREAM <${ldes_location2}> [RANGE 60000 STEP 20000]
FROM NAMED WINDOW :w3 ON STREAM <${ldes_location3}> [RANGE 60000 STEP 20000]
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

function generate_data(num_events: number, rdfStreams: RDFStream[]) {
    for (let i = 0; i < num_events; i++) {

        rdfStreams.forEach((stream) => {
            const stream_element = quad(
                namedNode('https://rsp.js/test_subject_' + i),
                namedNode('https://saref.etsi.org/core/hasValue'),
                literal(`${Math.random() * 10}`, namedNode('http://www.w3.org/2001/XMLSchema#integer')),
                defaultGraph(),
            );

            const stream_element2 = quad(
                namedNode('https://rsp.js/test_subject_' + i),
                namedNode('https://saref.etsi.org/core/relatesToProperty'),
                namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x'),
                defaultGraph(),
            );
            stream.add(stream_element2, i);
            stream.add(stream_element, i);
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
        generate_dummy_data_with_frequency(5000, rdfStreams, 16);
    }

    emitter.on('RStream', (data: any) => {
        console.log(`Data is`, data.bindings.toString());
        results.push(data);
    });

    const sleep = (ms: any) => new Promise(r => setTimeout(r, ms));
    await sleep(2000);
    console.log(results);
}

// run();



function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generate_dummy_data_with_frequency(number_of_events: number, rdfStreams: RDFStream[], frequency: number) {
    let eventsGenerated = 0; // Counter to track the number of events generated
    const sleepInterval = 1000 / frequency; // Time interval between generating each event in milliseconds

    while (eventsGenerated < number_of_events) {
        rdfStreams.forEach((stream: any) => {
            if (eventsGenerated < number_of_events) {
                const stream_element = quad(
                    namedNode('https://rsp.js/test_subject_' + eventsGenerated),
                    namedNode('https://saref.etsi.org/core/hasValue'),
                    literal(`${Math.random() * 10}`, namedNode('http://www.w3.org/2001/XMLSchema#integer')),
                    defaultGraph()
                );

                const stream_element2 = quad(
                    namedNode('https://rsp.js/test_subject_' + eventsGenerated),
                    namedNode('https://saref.etsi.org/core/relatesToProperty'),
                    namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x'),
                    defaultGraph()
                );

                const stream_element3 = quad(
                    namedNode('https://rsp.js/test_subject_' + eventsGenerated),
                    namedNode('https://saref.etsi.org/core/rangeValue'),
                    literal(`${Math.random() * 10}`, namedNode('http://www.w3.org/2001/XMLSchema#integer')),
                    defaultGraph()
                );

                const stream_element4 = quad(
                    namedNode('https://rsp.js/test_subject_' + eventsGenerated),
                    namedNode('https://saref.etsi.org/core/ysValue'),
                    namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.y'),
                    defaultGraph()
                );

                const stream_element5 = quad(
                    namedNode('https://rsp.js/test_subject_' + eventsGenerated),
                    namedNode('https://saref.etsi.org/core/superRandom'),
                    namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleratioy'),
                    defaultGraph()
                );

                const stream_element6 = quad(
                    namedNode('https://rsp.js/test_subject_' + eventsGenerated),
                    namedNode('https://saref.etsi.org/core/relProperty'),
                    namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.z'),
                    defaultGraph()
                );

                const timestamp = Date.now(); // Get the current epoch time in milliseconds
                stream.add(stream_element, timestamp);
                stream.add(stream_element2, timestamp);
                stream.add(stream_element3, timestamp);
                stream.add(stream_element4, timestamp);
                stream.add(stream_element5, timestamp);
                stream.add(stream_element6, timestamp);
                eventsGenerated += 1; // Increment the counter
            }
        });

        await sleep(sleepInterval); // Sleep for the calculated interval to maintain the frequency
    }
}

async function test() {
    const cpu_usage = process.cpuUsage();
    const memory_usage = process.memoryUsage();
    console.log(cpu_usage);
    console.log(memory_usage);
}

test();