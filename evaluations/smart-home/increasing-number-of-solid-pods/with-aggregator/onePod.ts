
// Import necessary libraries
import { Readable } from 'stream';
import { Parser } from 'n3';
import { performance } from 'perf_hooks';
import { Writable } from 'stream';

// Define the RDF stream
const rdfStream = new Readable({
  read() {}
});

// Define the parser
const parser = new Parser();

// Define the throughput calculation function
function calculateThroughput(startTime: number, endTime: number, numTriples: number) {
  const totalTime = endTime - startTime;
  const throughput = numTriples / totalTime;
  console.log(`Throughput: ${throughput} triples/ms`);
}


// Define the writable stream
const writable = new Writable({
    write(chunk, encoding, callback) {
        numTriples++;
        callback();
    }
});

// Parse the RDF stream
rdfStream.pipe(writable);

// Count the number of triples
let numTriples = 0;
const startTime = performance.now();

// End the timer and calculate the throughput
(parser as any).on('end', () => {
    const endTime = performance.now();
    calculateThroughput(startTime, endTime, numTriples);
});
