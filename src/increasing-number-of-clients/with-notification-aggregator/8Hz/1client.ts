import { initializeNotificationClients } from "../util/generate-clients";

async function one_client(){
    await initializeNotificationClients(1)
}

one_client();