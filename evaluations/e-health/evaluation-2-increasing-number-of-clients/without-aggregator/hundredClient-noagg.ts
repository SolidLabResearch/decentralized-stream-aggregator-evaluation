import { create_non_aggregator_client, record_usage } from "./Util";

async function hundredClientNoAgg() {
    record_usage(`number-of-clients-100-noagg`, `query-client-number-100`, 1000)
    create_non_aggregator_client(100);
}

hundredClientNoAgg();