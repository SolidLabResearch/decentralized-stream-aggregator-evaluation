import { initializeWithoutAggregatorClients } from "../util/generate-clients";

async function two_client() {
    await initializeWithoutAggregatorClients(2);
}

two_client();