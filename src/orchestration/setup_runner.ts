import { Client } from 'ssh2';

const config = {
    
}

function run_command(host: string, username: string, password: string, command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const connection = new Client();

        connection.on('ready', () => {
            connection.exec(command, (error: any, stream: any) => {
                if (error) {
                    throw new Error(error);
                }
                stream.on('close', (code: any, signal: any) => {
                    connection.end();
                    resolve();
                }).on('data', (data: any) => {
                    console.log(`STDOUT: ${data}`);
                }).stderr.on('data', (data: any) => {
                    console.error(`STDERR: ${data}`);
                });
            })
        }).connect({
            host,
            port: 22,
            username,
            password,
        });
    });
}


async function run_benchmark() {
    try {
        // 1. Delete the notifications folder of the Solid Pod.

        // 2. Delete the existing LDES Streams on the Solid Pod.
        
        // 3. Stop the replayer process by killing it.

        // 4. Initialize the new LDES Stream containers on the Solid Pod.

        // 5. Restart the aggregator service.
        
        // 6. Run the next script on the folder to simulate a client.

        // 7. Start the replayer process again.

    } catch (error) {
        console.error(`An error occurred: ${error}`);
    }
}
