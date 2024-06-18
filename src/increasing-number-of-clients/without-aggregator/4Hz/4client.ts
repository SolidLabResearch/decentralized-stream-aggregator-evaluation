import { initializeWithoutAggregatorClients } from "../util/generate-clients";

async function four_client() {
    await initializeWithoutAggregatorClients(4);
}

four_client();