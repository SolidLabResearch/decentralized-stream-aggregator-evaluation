import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";

const ldes_locations = ["http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/", "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/", "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/"]
async function main() {
    for (let ldes_location of ldes_locations) {
        let ldes = new LDESinLDP(ldes_location, new LDPCommunication());
        await ldes.initialise({
            treePath: "https://saref.etsi.org/core/hasTimestamp"
        }).then(() => {
            console.log("Initialisation of LDES is done");
        });
    }
}

main();