import { initializeClients } from './generate-clients';

async function main() {
    await initializeClients(10);
}

main();