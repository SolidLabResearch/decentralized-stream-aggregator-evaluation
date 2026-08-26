import { StreamTriplet, WorkloadMode } from "./config";

/** The canonical 4 Hz query, copied verbatim in meaning from the three 4 Hz entrypoint implementations. */
export function buildActivityIndexQuery(streams: StreamTriplet, options?: { workloadMode?: WorkloadMode; workloadInstance?: number }): string {
    const mode = options?.workloadMode || "same-query-same-data";
    const instance = options?.workloadInstance ?? 0;
    if (!Number.isInteger(instance) || instance < 0 || instance > 2) throw new Error("workloadInstance must be 0, 1, or 2.");
    if (mode !== "same-query-same-data" && mode !== "different-query-same-data" && mode !== "different-query-different-data") throw new Error(`Unsupported workload mode: ${mode}`);
    if (mode === "same-query-same-data" && instance !== 0) throw new Error("same-query-same-data has one formal query: workloadInstance 0.");
    // Keep the legacy no-options Q0 output byte-for-byte identical.
    const descriptor = instance === 0
        ? "saref:relatesToProperty dahccsensors:wearable.acceleration.x"
        : instance === 1
            ? "saref:measurementMadeBy dahccsensors:E4.A03846.Accelerometer"
            : "dcterms:isVersionOf saref:Measurement";
    const dctermsPrefix = instance === 2 ? "PREFIX dcterms: <http://purl.org/dc/terms/>\n" : "";
    const legacyPrefixTrailingSpace = " ";
    const legacyW3TrailingSpaces = "    ";
    return `
PREFIX saref: <https://saref.etsi.org/core/>
${dctermsPrefix}PREFIX func: <http://extension.org/functions#>${legacyPrefixTrailingSpace}
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
        ?s ${descriptor} .
    }
    WINDOW :w2 {
        ?s saref:hasValue ?o2 .
        ?s ${descriptor} .
    }   
    WINDOW :w3 {
        ?s saref:hasValue ?o3 .
        ?s ${descriptor} .${legacyW3TrailingSpaces}
    }
}
`;
}
