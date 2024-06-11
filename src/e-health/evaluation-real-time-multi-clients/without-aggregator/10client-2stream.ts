import { initializeWithoutAggregatorClients } from './generate-without-aggregator-clients';

async function ten_client_two_stream() {
    await initializeWithoutAggregatorClients(10, 2);
}

ten_client_two_stream();