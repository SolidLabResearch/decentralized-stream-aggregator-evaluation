const assert = require("assert");
const { discoverService, discoverStreams, endpointForService, rdfStore } = require("../src/initialization-benchmark/benchmark");

const pod = "http://pod.example/pod1/";
const streams = {
    x: "http://pod.example/pod1/acc-x/",
    y: "http://pod.example/pod1/acc-y/",
    z: "http://pod.example/pod1/acc-z/"
};
const metrics = {
    x: "https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x",
    y: "https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.y",
    z: "https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.z"
};

function response(body, url) {
    return { ok: true, status: 200, url, text: async () => body };
}

async function main() {
    const serviceRdf = `@prefix schema: <https://schema.org/> . @prefix heimdall: <https://w3id.org/heimdall#> . <#h> a schema:Service ; schema:name "Heimdall" ; heimdall:webSocketEndpoint <ws://heimdall.example:8080/> .`;
    assert.strictEqual(endpointForService(rdfStore(serviceRdf, "http://pod.example/service-description.ttl")), "ws://heimdall.example:8080/");
    const serviceCalls = [];
    const service = await discoverService("http://pod.example/service-description.ttl", "test-1", async (url, options) => {
        serviceCalls.push({ url, options }); return response(serviceRdf, url);
    });
    assert.strictEqual(service.serviceUrl, "ws://heimdall.example:8080/");
    assert.ok(serviceCalls[0].url.includes("_initialization_benchmark=test-1"));
    assert.strictEqual(serviceCalls[0].options.headers["Cache-Control"], "no-cache, no-store");

    const profile = `@prefix solid: <http://www.w3.org/ns/solid/terms#> . <> solid:publicTypeIndex <${pod}settings/publicTypeIndex> .`;
    const typeIndex = `@prefix saref: <https://saref.etsi.org/core/> . <${streams.x}> saref:relatesToProperty <${metrics.x}> . <${streams.y}> saref:relatesToProperty <${metrics.y}> . <${streams.z}> saref:relatesToProperty <${metrics.z}> .`;
    const calls = [];
    const fakeFetch = async (url, options) => {
        calls.push({ url, options });
        if (url.startsWith(`${pod}profile/card`)) return response(profile, url);
        if (url.startsWith(`${pod}settings/publicTypeIndex`)) return response(typeIndex, url);
        if (Object.values(streams).some(stream => url.startsWith(stream))) return response("@prefix ex: <https://example/> . <https://example/s> ex:p ex:o .", url);
        throw new Error(`unexpected URL ${url}`);
    };
    const discovered = await discoverStreams({
        profileUrl: `${pod}profile/card`,
        metrics
    }, { fetch: fakeFetch }, "test-2");
    assert.deepStrictEqual(discovered, {
        profileUrl: `${pod}profile/card`,
        publicTypeIndexUrl: `${pod}settings/publicTypeIndex`,
        streamXUrl: streams.x,
        streamYUrl: streams.y,
        streamZUrl: streams.z
    });
    assert.strictEqual(calls.length, 5);
    assert.ok(calls.every(call => call.options.headers["Cache-Control"] === "no-cache, no-store"));
    console.log("initialization benchmark focused tests passed");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
