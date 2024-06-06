import { initializeAggregatorClients } from "./generate-clients";

async function ten_clients() {
    await initializeAggregatorClients(10, 1);
}

ten_clients();