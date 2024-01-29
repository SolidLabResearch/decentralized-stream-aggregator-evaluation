import { storeToString, LDPCommunication } from "@treecg/versionawareldesinldp";
let ld_fetch = require('ldfetch');
let fetch_linked_data = new ld_fetch({});
const N3 = require('n3');
let communication = new LDPCommunication();

async function fetch_resource_and_post() {
    let url = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/1700038645363/e26f1bb2-92f5-4681-85db-8b8288874f0e";
    // let url = "http://localhost:3000/dataset_participant1/data/1690891151045/cab9b52d-1b26-4f64-a393-4b8360d7b598";
    let response = await fetch_linked_data.get(url);
    const store = new N3.Store(response.triples);
    let store_string = storeToString(store);
    let headers = new Headers({ 'Content-type': 'text/turtle' })
    for (let i = 0; i < 1000; i++) {
        communication.post('http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/1705488109282/', store_string, headers).then((response) => {
            if (response.status != 201) {
                console.log(i, response.status);
            }
        });

    }
}

async function fetch_resource() {
    let url = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/1700038645363/e26f1bb2-92f5-4681-85db-8b8288874f0e";

    // let url = "http://localhost:3000/dataset_participant1/data/1676276846171/02c210d7-ad92-4842-aae7-3d7a2805b90e";
    for (let i = 0; i < 30; i++) {
        communication.get(url).then((response) => {            
            if (response.status != 200) {
                console.log(`The request did not succeed, ${i}, ${response.status}`);
            }
        })
    }
}


// fetch_resource_and_post();
fetch_resource();