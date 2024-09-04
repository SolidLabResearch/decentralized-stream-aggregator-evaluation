import { RSPQLParser, R2ROperator, QuadContainer } from "rsp-js";
const N3 = require('n3');
import { Quad } from 'n3';
const { DataFactory } = N3;
const { namedNode, quad, literal } = DataFactory;
async function main() {
    const location_one = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
    const location_two = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
    const location_three = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
    let rspql_query = `
    PREFIX : <https://rsp.js/>
    PREFIX saref: <https://saref.etsi.org/core/>
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    PREFIX func: <http://extension.org/functions#>
    REGISTER RStream <output> AS
    SELECT (func:sqrt(?o1 * ?o1 + ?o2 * ?o2 + ?o3 * ?o3) AS ?activityIndex)
    FROM NAMED WINDOW :w1 ON STREAM <${location_one}> [RANGE 6000 STEP 2000]
    FROM NAMED WINDOW :w2 ON STREAM <${location_two}> [RANGE 6000 STEP 2000]
    FROM NAMED WINDOW :w3 ON STREAM <${location_three}> [RANGE 6000 STEP 2000]

    WHERE {
        WINDOW :w1 { 
        ?s1 saref:hasValue ?o1 .
        ?s1 saref:relatesToProperty dahccsensors:wearable.acceleration.x .
        }
        WINDOW :w2 {
        ?s2 saref:hasValue ?o2 .
        ?s2 saref:relatesToProperty dahccsensors:wearable.acceleration.x .
        }
        WINDOW :w3 {
        ?s3 saref:hasValue ?o3 .
        ?s3 saref:relatesToProperty dahccsensors:wearable.acceleration.x .
        }
    }
    `;

    let rspql_parser = new RSPQLParser();
    let parsed_query = rspql_parser.parse(rspql_query);
    let r2r = new R2ROperator(parsed_query.sparql);
    let quad_set = new Set<Quad>();
    let number_of_quads = 12/3;

    for (let i = 0; i < number_of_quads; i++) {
        const stream_element = quad(
            namedNode('https://rsp.js/test_subject_' + i),
            namedNode('https://saref.etsi.org/core/hasValue'),
            literal(`${Math.random() * 10}`, namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            namedNode('https://rsp.js/w1'),
        );

        const stream_element2 = quad(
            namedNode('https://rsp.js/test_subject_' + i),
            namedNode('https://saref.etsi.org/core/relatesToProperty'),
            namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x'),
            namedNode('https://rsp.js/w1'),
        );
        quad_set.add(stream_element);        
        quad_set.add(stream_element2);
    }

    for (let i = 0; i < number_of_quads; i++) {

        const stream_element = quad(
            namedNode('https://rsp.js/test_subject_' + i),
            namedNode('https://saref.etsi.org/core/hasValue'),
            literal(`${Math.random() * 10}`, namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            namedNode('https://rsp.js/w2'),
        );

        const stream_element2 = quad(
            namedNode('https://rsp.js/test_subject_' + i),
            namedNode('https://saref.etsi.org/core/relatesToProperty'),
            namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x'),
            namedNode('https://rsp.js/w2'),
        );
        quad_set.add(stream_element);        
        quad_set.add(stream_element2);
    }
    for (let i = 0; i < number_of_quads; i++) {
        const stream_element = quad(
            namedNode('https://rsp.js/test_subject_' + i),
            namedNode('https://saref.etsi.org/core/hasValue'),
            literal(`${Math.random() * 10}`, namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            namedNode('https://rsp.js/w3'),
        );

        const stream_element2 = quad(
            namedNode('https://rsp.js/test_subject_' + i),
            namedNode('https://saref.etsi.org/core/relatesToProperty'),
            namedNode('https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x'),
            namedNode('https://rsp.js/w3'),
        );
        quad_set.add(stream_element);        
        quad_set.add(stream_element2);
    }
    let quad_container = new QuadContainer(quad_set, 0);    
    let time = new Date().getTime();
    let bindings_stream = await r2r.execute(quad_container);
    console.log('Execution time: ', new Date().getTime() - time);
    let count = 0;
    bindings_stream.on('data', (binding: any) => {
            
        count++;
    });

    bindings_stream.on('data', (binding: any) => {
        console.log(binding.toString());
    });

    bindings_stream.on('end', () => {
    });
}

main();