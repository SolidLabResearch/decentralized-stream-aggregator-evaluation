import { storeToString, LDPCommunication } from "@treecg/versionawareldesinldp";
let ld_fetch = require('ldfetch');
let fetch_linked_data = new ld_fetch({});
const N3 = require('n3');
const https = require('https');
let communication = new LDPCommunication();

async function fetch_resource_and_post() {
    let url = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/1700816594000/96fd7685-607d-4dd4-bb47-438e71a661ad';
    let response = await fetch_linked_data.get(url);
    const store = new N3.Store(response.triples);
    // let store_string = storeToString(store);
    let store_string = `
<http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs222> .
<http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs224> .
<http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs225> .
<http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs226> .
<http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs227> .
<http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs228> .
<http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs229> .
<http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs90> .
<http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs91> .
<http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs92> .    `
    let headers = new Headers({ 'Content-type': 'text/turtle' })
    communication.post('http://localhost:3001/test/', store_string, headers).then((response) => {
        if (response.status != 201) {
            console.log(response.status);
        }
    });
}

async function fetch_resource() {
    let url = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/1700038645363/e26f1bb2-92f5-4681-85db-8b8288874f0e";
    let promises: Promise<Response>[] = [];

    for (let i = 0; i < 10; i++) {
        promises.push(communication.get(url));
    }

    Promise.all(promises).then(async (responses: Response[]) => {
for (let response of responses) {
    console.log(await response.text());  
}       
    });
}



async function test() {
    let communication = new LDPCommunication();
    let store_string = `
    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs222> .
    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs224> .
    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs225> .
    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs226> .
    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs227> .
    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs228> .
    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs229> .
    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs90> .
    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs91> .
    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs92> .    `
    let headers = new Headers({ 'Content-type': 'text/turtle' });
    try {
        communication.get('https://localhost:8443/').then((response) => {
            console.log(response.status);
        });
        // communication.post('http://localhost:3001/', store_string, headers).then((response) => {
        //     console.log(response.status);
        // })
    } catch (error) {
        console.log(`The error is: ${error}`);
    }
}

async function fetch_test() {
    fetch('http://localhost:3001/').then((response) => {
        console.log(response.status);
    });
}

async function test_fetch_https(){
    // const agent = new https.Agent({
    //     rejectUnauthorized: false
    // });

    const https_proxy_agent = require('https-proxy-agent');
    const agent = new https_proxy_agent('http://localhost:8443/');

    const method = 'GET';


    // fetch('https://localhost:8443/', {method, agent})

}

async function test_fetch_https2(){
    let headersList = {
        "Accept": "*/*",
        "User-Agent": "Kush",
        "Content-Type": "text/plain"
       }
       
       let bodyContent = "    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs222> .\n    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs224> .\n    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs225> .\n    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs226> .\n    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs227> .\n    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs228> .\n    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs229> .\n    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs90> .\n    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs91> .\n    <http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/#EventStream> <https://w3id.org/tree#member> <https://dahcc.idlab.ugent.be/Protego/_participant1/obs92> .    ";
       process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
       let response = await fetch("https://localhost:8443/", { 
         method: "POST",
         body: bodyContent,
         headers: headersList
       });
       
       let data = await response.text();
       console.log(data);      
}

// fetch_resource_and_post();
// fetch_resource();
// test();
// fetch_test();
test_fetch_https2();