import { initializeWithoutAggregatorClients } from "../util/generate-clients";
import * as fs from 'fs';

async function five_client() {
    const number_of_clients = 5;
    const time_first = Date.now();
    await initializeWithoutAggregatorClients(number_of_clients);
    const time_last = Date.now();
    fs.appendFileSync(`without-aggregator-${number_of_clients}-clients.csv`, `total_time,${time_last - time_first}\n`);
}

five_client();