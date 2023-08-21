
export class EndpointQueries {
    get_query(name: string, from_timestamp: Date, to_timestamp: Date) {
        let from = Date.parse(from_timestamp.toString())
        let to = Date.parse(to_timestamp.toString())
        let difference_seconds = (to - from) / 1000;
        if (name = "avgHR6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/> 
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    REGISTER RStream <output> AS
                    SELECT (AVG(?o) AS ?avgHR6)
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/wearable_bvp/> [RANGE ${difference_seconds} STEP 10]
                    WHERE{
                        WINDOW :w1 { ?s saref:hasValue ?o .
                                     ?s saref:relatesToProperty dahccsensors:wearable.bvp .}
        }`;
        }

        else if (name = "maxHR6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    REGISTER RStream <output> AS
                    SELECT (MAX(?o) AS ?maxHR1)
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/wearable_bvp/> [RANGE ${difference_seconds} STEP 10]
                    WHERE{
                        WINDOW :w1 { ?s saref:hasValue ?o .
                                        ?s saref:relatesToProperty dahccsensors:wearable.bvp .}
                        }
            `;
        }

        else if (name = "minHR6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    REGISTER RStream <output> AS
                    SELECT (MIN(?o) AS ?minHR6)
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/wearable_bvp/> [RANGE ${difference_seconds} STEP 10]
                    WHERE{
                        WINDOW :w1 { ?s saref:hasValue ?o .
                                        ?s saref:relatesToProperty dahccsensors:wearable.bvp .}
                        }
            `;
        }

        else if (name = "countHR6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    REGISTER RStream <output> AS
                    SELECT (COUNT(?o) AS ?countHR6)
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/wearable_bvp/> [RANGE ${difference_seconds} STEP 10]
                    WHERE{
                        WINDOW :w1 { ?s saref:hasValue ?o .
                                        ?s saref:relatesToProperty dahccsensors:wearable.bvp .}
                        };
            `
        }
        else if (name = "sumHR6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    REGISTER RStream <output> AS
                    SELECT (SUM(?o) AS ?sumHR6)
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/wearable_bvp/> [RANGE ${difference_seconds} STEP 10]
                    WHERE{
                        WINDOW :w1 { ?s saref:hasValue ?o .
                                        ?s saref:relatesToProperty dahccsensors:wearable.bvp .}
                        }
            `;
        }
        else if (name = "selectHR6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    SELECT ?value
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/wearable_bvp/> [RANGE ${difference_seconds} STEP 10]
                    WHERE{
                        WINDOW :w1 { ?s saref:hasValue ?value .}
                    }
            `;
        }

        else if (name = "filterHR6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    SELECT ?value
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/wearable_bvp/> [RANGE ${difference_seconds} STEP 10]
                    WHERE{
                        WINDOW :w1 { ?s saref:hasValue ?value .
                            FILTER (?value > 1 && ?value < 3)
                        }
                    }
            `;
        }

        else if (name = "joinHR6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    SELECT ?value
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/wearable_bvp/> [RANGE ${difference_seconds} STEP 10]
                    WHERE {
                        WINDOW :w1 { ?observation saref:hasValue ?value .
                        ?observation saref:hasTimestamp ?timestamp .}
                    }
        
            `
        }

        else if (name = "subqueryHR6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    PREFIX dct: <http://purl.org/dc/terms/>
                    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                    REGISTER RStream <output> AS
                    SELECT ?value
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/wearable_bvp/> [RANGE ${difference_seconds} STEP 10]
                    WHERE {
                        WINDOW :w1 { ?observation saref:hasTimestamp ?timestamp .   
                        ?observation saref:hasValue ?value .
                        ?observation saref:measurementMadeBy ?sensor .
                        ?observation dct:isVersionOf ?measurement .
                    
                    {
                        SELECT DISTINCT ?sensor
                        WHERE {
                            ?sensor saref:relatesToProperty dahccsensors:wearable.bvp .
                        }
                    }
                    ?measurement rdf:type saref:Measurement .
                    }
                    }
            `
        }

        else if (name = "complexPatternHR6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX : <https://rsp.js/>
                    PREFIX void: <http://rdfs.org/ns/void#>
                    PREFIX dct: <http://purl.org/dc/terms/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    REGISTER RStream <output> AS
                    SELECT ?value
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/wearable_bvp/> [RANGE ${difference_seconds} STEP 10]
                    WHERE {
                        WINDOW :w1 { ?observation saref:hasTimestamp ?timestamp .
                                    ?observation saref:hasValue ?value .
                                    ?observation saref:measurementMadeBy ?sensor .
                                    ?observation dct:isVersionOf ?measurement .
                            ?sensor saref:relatesToProperty dahccsensors:wearable.bvp .

                            OPTIONAL {
                                ?observation void:inDataset ?dataset .
                            }
                                
                        FILTER (?value > 1 && ?value < 3)
                        }
                        ORDER BY ASC(?timestamp)
                    }
            `;
        }

        else if (name = "temp6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    REGISTER RStream <output> AS
                    SELECT (AVG(?o) AS ?avgTemp6)
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/temperature/> [RANGE ${difference_seconds} STEP 20]
                    WHERE{
                        WINDOW :w1 { ?s saref:hasValue ?o .
                                        ?s saref:relatesToProperty dahccsensors:org.dyamand.types.common.Temperature}
                    }
            `
        }

        else if (name = "SpO2Patient6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    REGISTER RStream <output> AS
                    SELECT (AVG(?o) AS ?avgSpO2Patient6)
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/spo2/> [RANGE ${difference_seconds} STEP 20]
                    WHERE{
                        WINDOW :w1 { ?s saref:hasValue ?o .
                                        ?s saref:relatesToProperty dahccsensors:org.dyamand.types.health.SpO2}
                        }
            `;
        }

        else if (name = "avgActivityLevel6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    REGISTER RStream <output> AS
                    SELECT (?x ?y ?z)
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/wearable_acceleration/> [RANGE ${difference_seconds} STEP 20]
                    WHERE{
                        WINDOW :w1 { ?s saref:hasValue ?x .
                                        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .}
                        }
                        WINDOW :w1 { ?s saref:hasValue ?y .
                                    ?s saref:relatesToProperty dahccsensors:wearable.acceleration.y .}

                        WINDOW :w1 { ?s saref:hasValue ?z .
                                    ?s saref:relatesToProperty dahccsensors:wearable.acceleration.z .}
                        }
            `;
        }
        else if (name = "CO2Patient6") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/>
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    REGISTER RStream <output> AS
                    SELECT (AVG(?o) AS ?avgCO2Patient6)
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/data/co2/> [RANGE ${difference_seconds} STEP 20]
                    WHERE{
                        WINDOW :w1 { ?s saref:hasValue ?o .
                                        ?s saref:relatesToProperty dahccsensors:org.dyamand.types.common.CO2}
                        }
            `;
        }
        else if (name = "averageHRPatient1") {
            return `
                    PREFIX saref: <https://saref.etsi.org/core/> 
                    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
                    PREFIX : <https://rsp.js/>
                    REGISTER RStream <output> AS
                    SELECT (AVG(?o) AS ?averageHR1)
                    FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/dataset_participant1/data/> [RANGE ${difference_seconds} STEP 20]
                    WHERE{
                        WINDOW :w1 { ?s saref:hasValue ?o .
                                     ?s saref:relatesToProperty dahccsensors:wearable.bvp .}
                    }                     
            `;
        }
        else if (name = "averageHRPatient2") {
            return `
        PREFIX saref: <https://saref.etsi.org/core/>
        PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
        PREFIX : <https://rsp.js/>
        REGISTER RStream <output> AS
        SELECT (AVG(?o) AS ?averageHR2)
        FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/dataset_participant2/data/> [RANGE ${difference_seconds} STEP 20]
        WHERE{
            WINDOW :w1 { ?s saref:hasValue ?o .
                            ?s saref:relatesToProperty dahccsensors:wearable.bvp .}
        }`;
        }
    }
}
