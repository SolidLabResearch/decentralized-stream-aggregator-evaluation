import * as fs from 'fs';
process.on('message', (message: { num1: number, num2: number }) => {
    const { num1, num2 } = message;
    const sum = num1 + num2;

    // Send the result back to the master process
    process.send?.({ sum });
});
