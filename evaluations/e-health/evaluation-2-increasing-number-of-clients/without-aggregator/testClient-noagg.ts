import { create_non_aggregator_client, record_usage } from "./Util";

async function oneClientNoAgg() {
    record_usage(`test-client-1-noagg`, `query-client-number-1`, 1000)
    create_non_aggregator_client(30);
}

oneClientNoAgg();