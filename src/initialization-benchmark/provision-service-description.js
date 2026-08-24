#!/usr/bin/env node

/* Provisioning is intentionally outside the timed benchmark. */
const fs = require("fs");
const path = require("path");
const { discoverService, createAuthenticatedSession } = require("./benchmark");

function required(name) {
    if (!process.env[name]) throw new Error(`Missing required environment variable ${name}.`);
    return process.env[name];
}

async function main() {
    const podUrl = required("SOLID_POD_URL").replace(/\/$/, "") + "/";
    const resourceUrl = process.env.SERVICE_DESCRIPTION_URL || `${podUrl}service-description.ttl`;
    const endpoint = required("EXPECTED_HEIMDALL_WS_URL");
    const templatePath = process.env.SERVICE_DESCRIPTION_TEMPLATE || path.join(__dirname, "service-description.template.ttl");
    const body = fs.readFileSync(templatePath, "utf8").replace("__HEIMDALL_WEBSOCKET_ENDPOINT__", endpoint);
    const config = {
        issuer: required("SOLID_OIDC_ISSUER"),
        clientId: required("SOLID_CLIENT_ID"),
        clientSecret: required("SOLID_CLIENT_SECRET"),
        profileUrl: `${podUrl}profile/card`
    };
    const session = await createAuthenticatedSession(config, `provision-${Date.now()}`);
    const response = await session.fetch(resourceUrl, {
        method: "PUT",
        headers: { "content-type": "text/turtle" },
        body
    });
    if (!response.ok) throw new Error(`Service-description PUT returned HTTP ${response.status}.`);
    const discovered = await discoverService(resourceUrl, `verify-${Date.now()}`);
    if (discovered.serviceUrl !== endpoint) throw new Error("Public service-description verification returned the wrong endpoint.");
    console.log(`Provisioned and publicly verified ${resourceUrl}`);
}

main().catch(error => {
    console.error(`Service-description provisioning failed: ${error.message}`);
    process.exitCode = 1;
});
