import { initializeWithoutAggregatorClients } from "../util/generate-clients";

async function nine_client() {
    await initializeWithoutAggregatorClients(9);
}

nine_client();