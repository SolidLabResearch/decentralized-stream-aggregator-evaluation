import { initializeWithoutAggregatorClients } from "../util/generate-clients";

async function one_client() {
    await initializeWithoutAggregatorClients(1);
}

one_client();