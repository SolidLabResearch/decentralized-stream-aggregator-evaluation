import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
import { ExperimentConfig, loadExperimentConfig, resolveStreams } from "./src/experiments/config/config";

export const treePath = "https://saref.etsi.org/core/hasTimestamp";

function loadConfiguredExperimentConfig(): ExperimentConfig {
    const configPath = process.env.EXPERIMENT_CONFIG_PATH;
    if (!configPath) throw new Error("EXPERIMENT_CONFIG_PATH is required when initializing LDES sources.");
    return loadExperimentConfig(configPath);
}

export function initializationTargets(config: ExperimentConfig = loadConfiguredExperimentConfig()): string[] {
    const streams = resolveStreams(config);
    return [streams.x, streams.y, streams.z];
}

export async function initialiseLdes(ldesLocations = initializationTargets()): Promise<void> {
    for (const ldesLocation of ldesLocations) {
        const ldes = new LDESinLDP(ldesLocation, new LDPCommunication());
        await ldes.initialise({
            treePath
        }).then(() => {
            console.log("Initialisation of LDES is done");
        });
    }
}

if (require.main === module) {
    initialiseLdes().catch((error: Error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
