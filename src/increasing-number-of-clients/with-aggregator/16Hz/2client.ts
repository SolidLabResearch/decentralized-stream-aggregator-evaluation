import { initializeAggregatorClients } from '../util/generate-clients';

async function two_client() {
    await initializeAggregatorClients(2);
}

two_client();