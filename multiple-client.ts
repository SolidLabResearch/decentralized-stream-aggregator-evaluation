import { LDPCommunication } from "@treecg/versionawareldesinldp";
let communication = new LDPCommunication();

async function client() {
    let url = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/1700038645363/e26f1bb2-92f5-4681-85db-8b8288874f0e";
    for (let i = 0; i < 100; i++) {
        communication.get(url).then((response) => {
                console.log(`Got a response back for iteration ${i}`)
            if (response.status != 200) {
                console.log(`The request did not succeed, ${i}, ${response.status}`);
            }
        })
    }
}

client();