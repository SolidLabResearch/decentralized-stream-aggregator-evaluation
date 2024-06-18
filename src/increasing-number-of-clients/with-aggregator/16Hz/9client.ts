import { initializeAggregatorClients } from '../util/generate-clients';

async function nine_client() {
    await initializeAggregatorClients(9);
}

nine_client();