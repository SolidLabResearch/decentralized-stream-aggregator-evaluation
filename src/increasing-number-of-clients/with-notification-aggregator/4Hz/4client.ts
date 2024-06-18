import { initializeNotificationClients } from "../util/generate-clients";

async function four_client(){
    await initializeNotificationClients(4)
}

four_client();