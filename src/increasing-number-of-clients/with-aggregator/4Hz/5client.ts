import { initializeAggregatorClients } from '../util/generate-clients';

async function five_client() {
    await initializeAggregatorClients(5);
}

five_client();