import { initializeWithoutAggregatorClients } from "../util/generate-clients";

async function five_client() {
    await initializeWithoutAggregatorClients(5);
}

five_client();