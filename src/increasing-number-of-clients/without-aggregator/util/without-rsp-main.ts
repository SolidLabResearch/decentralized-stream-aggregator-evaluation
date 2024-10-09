import { fork, ChildProcess } from "child_process";

// This function will fork the clients into separate processes

export async function initializeWithoutAggregatorWithoutRSPClients(number_of_clients: number): Promise<void> {
    for (let i = 0; i < number_of_clients; i++) {
        const client_process: ChildProcess = fork('./without-rsp-client.ts');

        client_process.send(
            { number_of_clients, current_client_index: i }
        );

        client_process.on('message', (message: string) => {
            console.log(`Client ${i}: ${message}`);
        });

        client_process.on('exit', (code: number) => {
            console.log(`Client ${i} exited with code ${code}`);
        });
    }

}

initializeWithoutAggregatorWithoutRSPClients(1);