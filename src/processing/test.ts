import * as fs from 'fs';
import { calculate_mean, calculate_standard_deviation, find_maximum, find_minimum, calculate_sum } from '../util/Util'
const file = fs.readFileSync('/home/kush/Code/RSP/evaluation-analysis/delay_32Hz_1client.csv', 'utf-8');
const lines = file.split('\n');
let event_delay_array: number[] = [];

lines.forEach((line) => {
    if (line as unknown as number != 0){
        event_delay_array.push(parseFloat(line));            
    }
});

console.log(event_delay_array.length);


// console.log(`Mean: ${calculate_mean(event_delay_array)}`);
// console.log(`Standard Deviation: ${calculate_standard_deviation(event_delay_array)}`);
// console.log(`Minimum: ${find_minimum(event_delay_array)}`);
// console.log(`Maximum: ${find_maximum(event_delay_array)}`);
// console.log(`Length: ${event_delay_array.length / 6}`);
