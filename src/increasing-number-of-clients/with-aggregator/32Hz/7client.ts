import { initializeAggregatorClients } from '../util/generate-clients';

async function seven_client() {
    await initializeAggregatorClients(7);
}

seven_client();