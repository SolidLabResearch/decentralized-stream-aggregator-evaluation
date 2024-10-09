import { RSPQLParser, R2ROperator, QuadContainer, RSPEngine } from "rsp-js";
const N3 = require('n3');
import { Quad } from 'n3';
const { DataFactory } = N3;
const { namedNode, quad, literal, defaultGraph } = DataFactory;
const ldes_acc_x = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
const ldes_acc_y = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/";
const ldes_acc_z = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/";
async function main() {
    ``
    const query = `
    PREFIX saref: <https://saref.etsi.org/core/>
    PREFIX func: <http://extension.org/functions#>
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    PREFIX podx: <http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/>
    PREFIX pody: <http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/> 
    PREFIX podz: <http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/>
    PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT * 
    FROM NAMED WINDOW podx: ON STREAM <${ldes_acc_x}> [RANGE 6 STEP 3]
    FROM NAMED WINDOW pody: ON STREAM <${ldes_acc_y}> [RANGE 6 STEP 3]
    FROM NAMED WINDOW podz: ON STREAM <${ldes_acc_z}> [RANGE 6 STEP 3]
    WHERE {
        WINDOW podx: {
            ?s saref:hasValue ?o .
            ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
        }
    }
    `;

    let rspql_parser = new RSPQLParser();
    let parsed_query = rspql_parser.parse(query);
    console.log(parsed_query.sparql);

    let r2r = new R2ROperator(parsed_query.sparql);
    let quad_set = new Set<Quad>();
    let number_of_quads = 100 / 3;

    let rsp_engine = new RSPEngine(query);
    let rsp_emitter = rsp_engine.register();
    let stream_one = rsp_engine.getStream(ldes_acc_x);
    let stream_two = rsp_engine.getStream(ldes_acc_y);
    let stream_three = rsp_engine.getStream(ldes_acc_z);

    if (stream_one && stream_two && stream_three) {
        const stream_element_one = quad(
            namedNode('https://rsp.js/test_subject_1'),
            namedNode('https://saref.etsi.org/core/hasValue'),
            literal(`${Math.random() * 10
                } `, namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            defaultGraph()
            // namedNode('http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/'),
        );
        const stream_element_two = quad(
            namedNode('https://rsp.js/test_subject_1'),
            namedNode('https://saref.etsi.org/core/relatesToProperty'),
            namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x'),
            defaultGraph()
            // namedNode('http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/'),
        );
        stream_one.add(stream_element_one, 0);
        stream_one.add(stream_element_two, 0);

        stream_one.add(stream_element_one, 1);
        stream_one.add(stream_element_two, 1);

        stream_one.add(stream_element_one, 2);
        stream_one.add(stream_element_two, 2);

        stream_one.add(stream_element_one, 3);
        stream_one.add(stream_element_two, 3);

        stream_one.add(stream_element_one, 4);
        stream_one.add(stream_element_two, 4);

        stream_one.add(stream_element_one, 5);
        stream_one.add(stream_element_two, 5);


        stream_one.add(stream_element_one, 6);
        stream_one.add(stream_element_two, 6);

        stream_one.add(stream_element_one, 7);
        stream_one
    }

    rsp_emitter.on('RStream', (data: any) => {
        console.log(data.bindings.toString());        
    });

    for (let i = 0; i < number_of_quads; i++) {
        const stream_element = quad(
            namedNode('https://rsp.js/test_subject_' + i),
            namedNode('https://saref.etsi.org/core/hasValue'),
            literal(`${Math.random() * 10
                } `, namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            // defaultGraph()
            namedNode('http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/'),
        );

        const stream_element2 = quad(
            namedNode('https://rsp.js/test_subject_' + i),
            namedNode('https://saref.etsi.org/core/relatesToProperty'),
            namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x'),
            // defaultGraph()
            namedNode('http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/'),
        );
        quad_set.add(stream_element);
        quad_set.add(stream_element2);
    }

    for (let i = 0; i < number_of_quads; i++) {

        const stream_element = quad(
            namedNode('https://rsp.js/test_subject_' + i),
            namedNode('https://saref.etsi.org/core/hasValue'),
            literal(`${Math.random() * 10} `, namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            // defaultGraph()
            namedNode('http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/'),
        );

        const stream_element2 = quad(
            namedNode('https://rsp.js/test_subject_' + i),
            namedNode('https://saref.etsi.org/core/relatesToProperty'),
            namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x'),
            // defaultGraph()
            namedNode('http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/'),
        );
        quad_set.add(stream_element);
        quad_set.add(stream_element2);
    }
    for (let i = 0; i < number_of_quads; i++) {
        const stream_element = quad(
            namedNode('https://rsp.js/test_subject_' + i),
            namedNode('https://saref.etsi.org/core/hasValue'),
            literal(`${Math.random() * 10} `, namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            // defaultGraph()
            namedNode('http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/'),
        );

        const stream_element2 = quad(
            namedNode('https://rsp.js/test_subject_' + i),
            namedNode('https://saref.etsi.org/core/relatesToProperty'),
            namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x'),
            // defaultGraph()
            namedNode('http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/'),
        );
        quad_set.add(stream_element);
        quad_set.add(stream_element2);
    }
    let quad_container = new QuadContainer(quad_set, 0);
    let time = new Date().getTime();
    let cpu_now = process.cpuUsage();
    console.log('CPU usage: ', cpu_now);
    // let bindings_stream = await r2r.execute(quad_container);
    let cpu_then = process.cpuUsage(cpu_now);
    let cpu_without_diff = process.cpuUsage();
    console.log('CPU without diff: ', cpu_without_diff);
    console.log('CPU diff: ', cpu_then);
    console.log('Execution time: ', new Date().getTime() - time);
    let count = 0;
}

main();