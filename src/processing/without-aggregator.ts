import * as fs from 'fs';
const file = fs.readFileSync('/home/kush/Code/RSP/solid-stream-aggregator-evaluation/logs/increasing-number-of-clients/without-aggregator/32Hz/5client/5client.csv', 'utf-8');
const lines = file.split('\n');
import { calculate_mean, calculate_standard_deviation, find_maximum, find_minimum, calculate_sum } from '../util/Util'
const pre_preprocess_array: number[] = [];
const add_event_to_rsp_engine_array: number[] = [];
const received_aggregation_event_array: number[] = [];
const time_to_fetch_event_array: number[] = [];
const time_to_subscribe_array: number[] = [];

lines.forEach((line) => {
    const [key, value] = line.trim().split(',');

    if (line === '') {
        console.log(`The line is empty.`);
    }

    if (key === 'time_to_find_ldes_stream') {
        console.log(`The time to find LDES stream is ${value}.`);
    }
    else if (key === 'time_to_subscribe') {
        time_to_subscribe_array.push(Number(value));

    }

    else if (key === 'time_to_fetch_notification') {
        // console.log(`The time to fetch event is ${value}.`);
        
        time_to_fetch_event_array.push(Number(value));
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

console.log('add event mean', calculate_mean(add_event_to_rsp_engine_array))
console.log('add event sd', calculate_standard_deviation(add_event_to_rsp_engine_array));

console.log(calculate_mean(time_to_fetch_event_array));
console.log(calculate_standard_deviation(time_to_fetch_event_array));

console.log(calculate_sum(time_to_fetch_event_array));

// console.log(calculate_mean(time_to_subscribe_array));
// console.log(calculate_sum(time_to_subscribe_array));
// console.log(calculate_standard_deviation(time_to_subscribe_array));


// console.log(calculate_mean(add_event_to_rsp_engine_array));
// console.log(calculate_sum(add_event_to_rsp_engine_array));
// console.log(calculate_standard_deviation(add_event_to_rsp_engine_array));

// console.log(calculate_mean(received_aggregation_event_array));
// console.log(calculate_sum(received_aggregation_event_array));
// console.log(calculate_standard_deviation(received_aggregation_event_array));

// console.log(calculate_mean([199672, 212294]));
// console.log(calculate_standard_deviation([212294, 199672]));

// console.log(calculate_mean([92, 95, 94, 102, 98, 92, 95, 94, 102, 98]));
// console.log(calculate_sum([92, 95, 94, 102, 98, 92, 95, 94, 102, 98]));
// console.log(calculate_standard_deviation([92, 95, 94, 102, 98, 92, 95, 94, 102, 98]));

// console.log(calculate_mean([3256, 3329, 3102, 3310]))
// console.log(calculate_standard_deviation([3256, 3329, 3102, 3310]));





