import { create_websocket_clients } from "../Util";

async function create_hundred_clients() {
    create_websocket_clients(100);
}

create_hundred_clients();