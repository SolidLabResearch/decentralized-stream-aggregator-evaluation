import * as fs from 'fs';
let pre_process_total = 0;
let add_event_total = 0;
let total_time = 0;
let add_event_array: number[] = [];
let file_reader_array: number[] = [];
let pre_process_array: number[] = [];
let total_time_array: number[] = [];
let counter = 0;
const file = fs.readFileSync('noagg-300000-final.csv', 'utf-8');
const lines = file.split('\n');

lines.forEach((line) => {
    const [key, value] = line.trim().split(',');
    if (line === '') {
    }
    if (key === 'pre_process') {
        pre_process_array.push(parseInt(value, 10));
        pre_process_total += parseInt(value, 10);
    } else if (key === 'add_event') {            
        add_event_array.push(parseInt(value, 10));
        add_event_total += parseInt(value, 10);
    }
    else if (key === '60000') {
        total_time += parseInt(value, 10);
    }
    else if (key === 'Reader') {
        file_reader_array.push(parseInt(value, 10));
    }

});

// console.log(`Mean pre_process: ${calculateMean(pre_process_array)}`);
// console.log(`Standard deviation pre_process: ${calculateStandardDeviation(pre_process_array)}`);
// console.log(`Mean add_event: ${calculateMean(add_event_array)}`);
// console.log(`Standard deviation add_event: ${calculateStandardDeviation(add_event_array)}`);
// console.log(add_event_array.length/33);
let total_time_add_event = 0;
for (let item in add_event_array) {
    total_time_add_event += add_event_array[item];
}
// console.log(add_event_array.length);
console.log(calculateMean(add_event_array));
console.log(calculateStandardDeviation(add_event_array));
console.log(calculateMean(file_reader_array));
console.log(calculateStandardDeviation(file_reader_array));

// console.log(`Total add_event: ${total_time_add_event/33}`);
// console.log(calculateMean(file_reader_array));
// console.log(calculateStandardDeviation(file_reader_array));

function calculateMean(values: number[]): number {
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
}

function calculateStandardDeviation(values: number[]): number {
    const mean = calculateMean(values);
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    const sumSquaredDiff = squaredDifferences.reduce((acc, val) => acc + val, 0);
    const variance = sumSquaredDiff / values.length;
    return Math.sqrt(variance);
}