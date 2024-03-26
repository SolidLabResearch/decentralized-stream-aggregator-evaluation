import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";

async function main() {
    let ldes = new LDESinLDP('http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/', new LDPCommunication());
    await ldes.initialise({
        treePath: "https://saref.etsi.org/core/hasTimestamp"
    }).then(() => {
        console.log("Initialisation of LDES is done");
    });
}

main();