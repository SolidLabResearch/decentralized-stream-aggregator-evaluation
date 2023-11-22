import { LDESinLDP, LDPCommunication, extractLdesMetadata } from "@treecg/versionawareldesinldp";
let ldes_location = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp-1s/';
let ldes_in_ldp = new LDESinLDP(ldes_location, new LDPCommunication());
let counter = 0;

async function test() {
    let stream = await ldes_in_ldp.readMembersSorted();
    
    stream.on('data', (data) => {

    });
    stream.on('end', () => {
        console.log(`The stream has ended.`);
        
    });
}

test()

