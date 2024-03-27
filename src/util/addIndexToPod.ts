import { patch_aggregator_information } from "../e-health/evaluation-real-time/Util";

async function addIndexToPod(solid_pod_url: string, aggregator_location: string) {
    await patch_aggregator_information(solid_pod_url, aggregator_location);
    
}

addIndexToPod("http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/", "http://n061-20b.wall2.ilabt.iminds.be:8080/")