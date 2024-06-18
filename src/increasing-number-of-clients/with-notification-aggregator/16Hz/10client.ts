import { initializeNotificationClients } from "../util/generate-clients";

async function ten_client() {
    await initializeNotificationClients(10);
}

ten_client();