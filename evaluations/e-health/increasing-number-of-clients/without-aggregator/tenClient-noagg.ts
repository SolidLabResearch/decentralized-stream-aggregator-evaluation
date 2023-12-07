import { create_non_aggregator_client, record_usage } from "./Util";

async function tenClientNoAgg() {
    record_usage(`number-of-clients-10-noagg`, `query-client-number-10`, 1000)
    create_non_aggregator_client(10);
}

tenClientNoAgg();