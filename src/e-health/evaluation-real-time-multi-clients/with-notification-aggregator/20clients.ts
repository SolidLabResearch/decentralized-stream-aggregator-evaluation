import { initializeNotificationClients } from "./generate-notification-clients";

async function twenty_clients() {
    await initializeNotificationClients(20);
}

twenty_clients();