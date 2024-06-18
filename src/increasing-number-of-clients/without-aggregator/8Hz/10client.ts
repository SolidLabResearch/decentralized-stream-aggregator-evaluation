import { initializeWithoutAggregatorClients } from "../util/generate-clients";

async function ten_client() {
    await initializeWithoutAggregatorClients(10);
}

ten_client();