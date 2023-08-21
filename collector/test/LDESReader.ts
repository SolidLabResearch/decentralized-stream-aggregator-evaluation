import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";

async function main() {
    const ldes_in_ldp_identifier = "http://localhost:3000/participant6/data/wearable_bvp/";
    const ldes_in_ldp = new LDESinLDP(ldes_in_ldp_identifier, new LDPCommunication());
    const member_stream = await ldes_in_ldp.readMembersSorted({
        from: new Date("2023-08-11T08:48:28.5100"),
        until: new Date("2023-08-11T08:59:28.5100"),
        chronological: true,
    });

    let number_of_members = 0;

    member_stream.on('data', async (data) => {
        number_of_members++;
    })

    member_stream.on('end', async () => {
        console.log(`Number of members: ${number_of_members}`);
    });

}

main();