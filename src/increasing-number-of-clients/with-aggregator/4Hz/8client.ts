import { initializeAggregatorClients } from '../util/generate-clients';

async function eight_client() {
    await initializeAggregatorClients(8);
}

eight_client();