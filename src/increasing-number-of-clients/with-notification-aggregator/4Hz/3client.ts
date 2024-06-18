import { initializeNotificationClients } from "../util/generate-clients";

async function three_client(){
    await initializeNotificationClients(3)
}

three_client();