// import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";

// const ldes_locations = ["http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/", "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/", "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/"]
// async function main() {
//     for (let ldes_location of ldes_locations) {
//         let ldes = new LDESinLDP(ldes_location, new LDPCommunication());
//         await ldes.initialise({
//             treePath: "https://saref.etsi.org/core/hasTimestamp"
//         }).then(() => {
//             console.log("Initialisation of LDES is done");
//         });
//     }
// }

// main();

import axios from 'axios';

const sensor_locations = ["http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/", "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/", "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/"];
const timestamp_path = "https://saref.etsi.org/core/hasTimestamp";
async function create_sensor_container() {
    for (let sensor_location of sensor_locations) {
        axios.post(sensor_location, {}).then(() => {
            console.log(`Created container at ${sensor_location}`);
        });
    }
}


create_sensor_container();