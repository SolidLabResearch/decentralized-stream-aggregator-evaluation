import { fork, ChildProcess } from "child_process";

async function initializeAggregatorClients(number_of_clients: number): Promise<ChildProcess[]> {
    const childProcesses: ChildProcess[] = [];

    for (let i = 0; i < number_of_clients; i++) {
        const child = fork('./child-process-client.ts');
        childProcesses.push(child);

        child.send('start');

        child.on('message', (message: string) => {
            console.log(`Client ${i}: ${message}`);
        });

        child.on('exit', (code: number) => {
            console.log(`Client ${i} exited with code ${code}`);
        });
    }

    return childProcesses;
}

initializeAggregatorClients(1).then((childProcesses: ChildProcess[]) => {
    console.log(`Initialized ${childProcesses.length} clients`);
}).catch((error: Error) => {
    console.error(`Error initializing clients: ${error.message}`);
});