import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";

// const ldes_locations = ["http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/", "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/", "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/"]
const ldes_locations = ["http://193.190.127.221:3000/participant6/sensor/"];
async function main() {
    for (let ldes_location of ldes_locations) {
        // fetch(ldes_location, {
        //     method: 'PUT'
        // }).then(async (response) => {
        //     console.log(await response.text());
        // });
        let ldes = new LDESinLDP(ldes_location, new LDPCommunication());
        await ldes.initialise({
            treePath: "https://saref.etsi.org/core/hasTimestamp"
        }).then(() => {
            console.log("Initialisation of LDES is done");
        });
    }
}

main();