import { initializeNotificationClients } from "../util/generate-clients";

async function eight_client(){
    await initializeNotificationClients(8);
}

eight_client();