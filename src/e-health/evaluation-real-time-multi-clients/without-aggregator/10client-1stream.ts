import { initializeWithoutAggregatorClients } from './generate-without-aggregator-clients';

async function ten_client_one_stream() {
    await initializeWithoutAggregatorClients(10, 1);
}

ten_client_one_stream();