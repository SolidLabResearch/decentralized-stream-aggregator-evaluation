import { initializeWithoutAggregatorClients } from "../util/generate-clients";

async function six_client() {
    await initializeWithoutAggregatorClients(6);
}

six_client();