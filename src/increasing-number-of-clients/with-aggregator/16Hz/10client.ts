import { initializeAggregatorClients } from '../util/generate-clients';

async function ten_client() {
    await initializeAggregatorClients(10);
}

ten_client();