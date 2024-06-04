import { initializeNotificationClients } from "./generate-notification-clients";

async function test_clients(){
    await initializeNotificationClients(30);
}

test_clients();