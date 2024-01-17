import { create_non_aggregator_client, record_usage } from "./Util";

async function thousandClientNoAgg() {
    record_usage(`number-of-clients-1000-noagg`, `query-client-number-1000`, 1000)
    create_non_aggregator_client(1000);
}

thousandClientNoAgg();