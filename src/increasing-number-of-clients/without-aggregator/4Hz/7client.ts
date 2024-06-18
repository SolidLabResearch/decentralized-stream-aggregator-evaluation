import { initializeWithoutAggregatorClients } from "../util/generate-clients";

async function seven_client() {
    await initializeWithoutAggregatorClients(7);
}

seven_client();