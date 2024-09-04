import { initializeWithoutAggregatorClients } from "../util/generate-clients";
import { initializeUnmonitoredClients } from "../util/generate-unmonitored-clients";

async function five_client() {
    initializeWithoutAggregatorClients(1);
    initializeUnmonitoredClients(4);
}

five_client();