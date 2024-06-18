import { initializeWithoutAggregatorClients } from "../util/generate-clients";

async function three_client() {
    await initializeWithoutAggregatorClients(3);
}

three_client();