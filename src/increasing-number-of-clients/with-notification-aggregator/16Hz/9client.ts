import { initializeNotificationClients } from "../util/generate-clients";

async function nine_client(){
    await initializeNotificationClients(1)
}

nine_client();