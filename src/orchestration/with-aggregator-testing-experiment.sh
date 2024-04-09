#!/bin/bash

delete_notifications_folder(){
    rm -rf ./internal/notifications
    echo "deleted the notifications folder of the community solid server"
}

delete_skt_stream_folder(){
    rm -rf data/participant6/skt/
    echo "deleted the ldes skt stream folder"
}

initialize_ldes(){
    npx ts-node ./initializeLDES.ts
    echo "The LDES has been initialized"
}

replay_observations(){
    npm run start
    echo "The observations are being replayed"
}

register_query(){
    npx ts-node ./registerQuery.ts
    echo "The query has been registered"
}

