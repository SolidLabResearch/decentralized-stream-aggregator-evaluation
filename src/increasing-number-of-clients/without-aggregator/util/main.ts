// main.ts
import { fork, ChildProcess } from "child_process";
import * as fs from "fs";

// This function will fork the clients into separate processes
export async function initializeWithoutAggregatorClients(number_of_clients: number): Promise<void> {
    for (let i = 0; i < number_of_clients; i++) {
        const clientProcess: ChildProcess = fork('./client.ts');

        // Send the number_of_clients and client index to the child process
        clientProcess.send({ number_of_clients, current_client_index: i });

        // Optional: handle messages from the client
        clientProcess.on('message', (message: string) => {
            console.log(`Client ${i}: ${message}`);
        });

        // Optional: handle exit events from the child process
        clientProcess.on('exit', (code: number) => {
            console.log(`Client ${i} exited with code ${code}`);
        });
    }

    fs.appendFileSync(`without-aggregator-${number_of_clients}-clients.csv`, `starting_time,${Date.now()}\n`);
}

initializeWithoutAggregatorClients(10);