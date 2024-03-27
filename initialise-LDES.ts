import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
// const ldes_location = "http://localhost:3000/aggregation_pod/skt/";
const ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/";
async function main() {
    let ldes = new LDESinLDP(ldes_location, new LDPCommunication());
    await ldes.initialise({
        treePath: "https://saref.etsi.org/core/hasTimestamp"
    }).then(() => {
        console.log("Initialisation of LDES is done");
    });
}

main();