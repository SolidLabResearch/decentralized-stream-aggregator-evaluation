import { initializeNotificationClients } from "../util/generate-clients";

async function five_client(){
    await initializeNotificationClients(5);
}

five_client();