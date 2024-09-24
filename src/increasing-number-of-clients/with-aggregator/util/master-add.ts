import * as fs from 'fs';
import { fork } from 'child_process';
import { resolve } from 'path';

interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
}


// Define the path to the child process file
const childProcessPath = resolve(__dirname, 'child');

// Spawn the child process
const child = fork('./child-add.ts');
fs.writeFileSync('LOG-2.log', `timestamp,cpu_user,cpu_system,rss,heapTotal,heapUsed,external\n`);

// Calculate the sum
function logCpuMemoryUsage() {
    const cpuUsage = process.cpuUsage();
    const memoryUsage: MemoryUsage = process.memoryUsage();
    const timestamp = Date.now();

    const logData = `${timestamp}, ${cpuUsage.user}, ${cpuUsage.system}, ${memoryUsage.rss}, ${memoryUsage.heapTotal}, ${memoryUsage.heapUsed}, ${memoryUsage.external}\n`;
    fs.appendFileSync('LOG-2.log', logData);
}

setInterval(() => {
    logCpuMemoryUsage()
}, 1000);
// Define the numbers to sum
const num1 = 5;
const num2 = 10;

// Send the numbers to the child process every second
setInterval(() => {
    console.log(`Sending numbers: ${num1}, ${num2}`);
    child.send({ num1, num2 });
}, 1000);

// Listen for messages (results) from the child process
child.on('message', (message: any) => {
    console.log(`Sum received from child: ${message.sum}`);
});
