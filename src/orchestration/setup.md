## Orchestration of the Benchmark Setup.

The different setups we have here to benchmark are,
1. Without Aggregator Setup.
2. With Notifications Aggregator Setup.
3. With Decentralized Stream Aggregator Setup.

### Steps need to be done before each script to be run to prepare a fresh setup. 

1. Deletion of the `.internal/notifications/` folder such that the pod doesn't have an existing clients who have subscribed for notifications.
2. Deletion of the LDES stream location containers. `/acc-x/`, `/acc-y/` and  `/acc-z/`.
3. Stop the replayer process.
4. Initialize the LDES stream location containers. `/acc-x/`, `/acc-y/` and  `/acc-z/`.
5. Restart the aggregator service (in case of solid stream aggregator and the notifications aggregator).
6. Run the next script of the folder (i.e increase an extra client script)