import { create_non_aggregator_client } from "./Util";

async function oneClientNoAgg() {
    create_non_aggregator_client(1);
}

oneClientNoAgg();