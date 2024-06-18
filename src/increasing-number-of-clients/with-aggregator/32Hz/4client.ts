import { initializeAggregatorClients } from '../util/generate-clients';

async function four_client() {
    await initializeAggregatorClients(4);
}

four_client();