import { create_websocket_clients } from "../Util";

async function create_ten_thousand_clients() {
    create_websocket_clients(10000);
}

create_ten_thousand_clients();