import { initializeAggregatorClients } from '../util/generate-clients';

async function six_client() {
    await initializeAggregatorClients(6);
}

six_client();