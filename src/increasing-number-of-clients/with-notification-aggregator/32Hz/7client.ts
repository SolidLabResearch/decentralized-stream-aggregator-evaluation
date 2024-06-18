import { initializeNotificationClients } from "../util/generate-clients";

async function seven_client(){
    await initializeNotificationClients(7);
}

seven_client();