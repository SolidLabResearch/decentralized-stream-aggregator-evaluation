import * as csv from 'csv-writer';
import WebSocket from 'ws';
import { find_stream_aggregator, find_relevant_streams, record_usage } from '../Util';
let solid_pod_location = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/';
async function queryOneSecond() {
    let time_one = performance.now();
    let stream_aggregator: string = await find_stream_aggregator(solid_pod_location);
    let time_two = performance.now();
    let relevant_streams = await find_relevant_streams(solid_pod_location, ['https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.skt']);
    let time_three = performance.now();
    console.log(`Time to find stream aggregator: ${(time_two - time_one) / 1000}s`);
    console.log(`Time to find relevant streams: ${(time_three - time_two) / 1000}s`);

    // Write timings to CSV file
    const csvWriter = csv.createObjectCsvWriter({
        path: 'timings.csv',  // Specify the path where you want to save the CSV file
        header: [
            { id: 'second', title: 'Second' },
            { id: 'operation', title: 'Operation' },
            { id: 'time', title: 'Time (s)' },
        ],
        append: true,
    });

    await csvWriter.writeRecords([
        { second: 1, operation: 'find_stream_aggregator', time: (time_two - time_one) / 1000 },
        { second: 1, operation: 'find_relevant_streams', time: (time_three - time_two) / 1000 },
    ]);

    // let stream = relevant_streams[0];
    let stream = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/";
    const websocket = new WebSocket('ws://n061-20b.wall2.ilabt.iminds.be:8080//', 'solid-stream-aggregator-protocol', {
        perMessageDeflate: false
    });

    websocket.once('open', () => {
        let message_object = {
            query: `
            PREFIX sared: <https://saref.etsi.org/core/>
            PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
            PREFIX : <https://rsp.js/>
            REGISTER RStream <output> AS
            SELECT (MAX(?o) as ?maxSKT)
            FROM NAMED WINDOW :w1 ON STREAM <${stream}> [RANGE 1000 STEP 100]
            WHERE {
                WINDOW :w1 {
                    ?s sared:hasValue ?o .
                    ?s sared:relatesToProperty dahccsensors:wearable.skt .
                }
            }
            `,
            queryId: 'queryOneSecondSKT-with-aggregator'
        };

        websocket.send(JSON.stringify(message_object));
        record_usage('evaluation-1-increasing-window-sizes-skt', 'queryOneSecondSKT-with-aggregator', 1000);
    });

    websocket.on('message', (data) => {
        console.log(data.toString());
    });
}

queryOneSecond();