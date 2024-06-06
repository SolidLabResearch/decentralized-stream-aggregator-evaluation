import { initializeNotificationClients } from "./generate-notification-clients";

async function ten_clients() {
    await initializeNotificationClients(10,1);
}

ten_clients();