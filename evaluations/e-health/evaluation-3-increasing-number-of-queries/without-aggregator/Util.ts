import { RSPEngine } from "rsp-js";

const query = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?maxBVP)
FROM NAMED WINDOW :w ON STREAM <http://localhost:3000/dataset_participant1/data/> [RANGE 600 STEP 20]
WHERE {
    WINDOW :w {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.bvp .
    }
}
`;

export async function register_queries(number_of_queries: number) {
    for (let i = 1; i < number_of_queries; i++) {
        const modifiedQuery = query.replace(':w', `:w${i}`);
        let rsp_engine = new RSPEngine(modifiedQuery);
        let emitter = rsp_engine.register();
        emitter.on('RStream', async (data: any) => {
            console.log(data);
        });
    }
}

export async function run_concurrently(number_of_runs: number) {
    const promises = [];

    for (let runs = 0; runs < number_of_runs; runs++) {
        promises.push(register_queries(number_of_runs));
    }

    // waiting for all of the promises to resolve.
    await Promise.all(promises);
}