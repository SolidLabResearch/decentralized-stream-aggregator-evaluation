import { create_websocket_clients } from "../Util";

async function create_thousand_clients() {
    create_websocket_clients(1000);
}

create_thousand_clients();