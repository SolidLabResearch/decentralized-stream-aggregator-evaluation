import { initializeAggregatorClients } from '../util/generate-clients';

async function three_client() {
    await initializeAggregatorClients(3);
}

three_client();