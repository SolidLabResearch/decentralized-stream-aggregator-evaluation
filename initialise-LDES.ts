import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
const ldes_locations = ["http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/", "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/", "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/xyz/"]

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
``
main();