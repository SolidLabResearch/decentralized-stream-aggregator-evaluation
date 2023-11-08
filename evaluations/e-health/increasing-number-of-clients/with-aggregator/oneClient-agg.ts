import { create_websocket_clients } from "../Util";

async function create_one_client() {
    create_websocket_clients(1);
}

create_one_client();