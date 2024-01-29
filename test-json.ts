let message_object = {
    query: `
    PREFIX saref: <https://saref.etsi.org/core/> 
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (MAX(?o) as ?maxBVP)
    FROM NAMED WINDOW :w1 ON STREAM <http://> [RANGE 1 STEP 1]
    WHERE {
        WINDOW :w1 {
            ?s saref:hasValue ?o .
            ?s saref:relatesToProperty dahccsensors:wearable.bvp .
        }
    } 
    `,
    queryId: 'queryOneSecond-with-aggregator'
};

let message_object2 =         {
    query: '\n + PREFIX saref: <https://saref.etsi.org/core/> PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/> PREFIX : <https://rsp.js/> REGISTER RStream <output> AS SELECT (MAX(?o) as ?maxBVP) FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 180 STEP 20] WHERE {     WINDOW :w1 {         ?s saref:hasValue ?o .         ?s saref:relatesToProperty dahccsensors:wearable.bvp .     } }',
    queryId: 'query180sec'
  }

let message = {
    query: `
    PREFIX saref: <https://saref.etsi.org/core/>
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (MAX(?o) as ?maxBVP)
    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/> [RANGE 180 STEP 20]
    WHERE {
        WINDOW :w1 {
            ?s saref:hasValue ?o .
            ?s saref:relatesToProperty dahccsensors:wearable.bvp .
        }
    }
    `,
    queryId: 'query180sec'
}

console.log(JSON.parse(JSON.stringify(message)));