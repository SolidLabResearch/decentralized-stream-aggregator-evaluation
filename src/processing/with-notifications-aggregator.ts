import * as fs from 'fs';
const file = fs.readFileSync('/home/kush/Code/RSP/solid-stream-aggregator-evaluation/logs/increasing-number-of-clients/with-notifications-aggregator/16Hz/10client/10client.csv', 'utf-8');
const lines = file.split('\n');
import { calculate_mean, calculate_standard_deviation, find_maximum, find_minimum, calculate_sum } from '../util/Util'
const pre_preprocess_array: number[] = [];
const add_event_to_rsp_engine_array: number[] = [];
const received_aggregation_event_array: number[] = [];

lines.forEach((line) => {
    const [key, value] = line.trim().split(',');

    if (line === '') {
        console.log(`The line is empty.`);
    }

    if (key === 'time_to_find_ldes_stream') {
        console.log(`The time to find LDES stream is ${value}.`);
    }
    else if (key === 'time_to_subscribe_notifications') {
        console.log(`The time to subscribe notifications is ${value}.`);
    }
    else if (key === 'time_to_preprocess_event') {
        pre_preprocess_array.push(Number(value));
    }
    else if (key === 'time_to_add_event_to_rsp_engine') {
        add_event_to_rsp_engine_array.push(Number(value));
    }
    else if (key === 'time_received_aggregation_event') {
        received_aggregation_event_array.push(Number(value));
    }
    else {
        console.log(`The key ${key} is not recognized.`);
    }
});


console.log(calculate_mean(received_aggregation_event_array));
console.log(calculate_standard_deviation(received_aggregation_event_array));
console.log(calculate_sum(received_aggregation_event_array));

console.log(calculate_mean(pre_preprocess_array));
console.log(calculate_standard_deviation(pre_preprocess_array));

console.log('add event mean', calculate_mean(add_event_to_rsp_engine_array));
console.log('add event sd', calculate_standard_deviation(add_event_to_rsp_engine_array));






