import { initializeNotificationClients } from "../util/generate-clients";

async function two_client() {
    await initializeNotificationClients(2);
}

two_client();