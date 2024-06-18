import { initializeWithoutAggregatorClients } from "../util/generate-clients";

async function eight_client() {
    await initializeWithoutAggregatorClients(8);
}

eight_client();
