import { initializeNotificationClients } from "../util/generate-clients";

async function six_client() {
    await initializeNotificationClients(6);
}

six_client();