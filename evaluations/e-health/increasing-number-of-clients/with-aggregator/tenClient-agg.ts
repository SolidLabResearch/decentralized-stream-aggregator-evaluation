import { create_websocket_clients } from "../Util";

async function create_ten_clients() {
    create_websocket_clients(10);
}

create_ten_clients();