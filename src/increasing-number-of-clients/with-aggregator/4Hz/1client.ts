import { initializeAggregatorClients } from '../util/generate-clients';

async function one_client() {
    await initializeAggregatorClients(1);
}

one_client();