import * as path from "path";
import { WebSocket } from "ws";
import { loadExperimentConfig } from "../../config/config";
import { buildActivityIndexQuery } from "../../config/query";
import { monitorCurrentProcess } from "../../monitoring/process-monitor";
import { clientRuntime } from "../shared/runtime";

const config = loadExperimentConfig();
const { clientIndex, outputDirectory } = clientRuntime();
const monitor = monitorCurrentProcess(path.join(outputDirectory, `client-${clientIndex}-resource.csv`), config.experiment.resourceSamplingIntervalMs);
const results = require("fs").createWriteStream(path.join(outputDirectory, `client-${clientIndex}-results.csv`), { flags: "w" });
results.write("timestamp,result\n");
const websocket = new WebSocket(config.urls.heimdall, "solid-stream-aggregator-protocol", { perMessageDeflate: false });

websocket.once("open", () => websocket.send(JSON.stringify({ query: buildActivityIndexQuery(config.streams), type: "live" })));
websocket.on("message", (data) => results.write(`${Date.now()},${JSON.stringify(data.toString())}\n`));
websocket.on("error", (error) => console.error(`Heimdall client ${clientIndex}: ${error.message}`));
const shutdown = async () => { websocket.close(); await monitor.stop(); results.end(); process.exit(0); };
process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown);
