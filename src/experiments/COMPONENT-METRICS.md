# Component latency metric mapping

All client-local records use `run_id, approach, client_id, query_id, event_id, stream_id, operation, start_epoch_ms, end_epoch_ms, start_monotonic_ns, end_monotonic_ns, duration_ms`.  The epoch values for RSP-JS monotonic metrics are converted using one per-process epoch/monotonic anchor; the monotonic duration remains authoritative locally.

| Manuscript row | Approach | Raw metric | Component | Start boundary | End boundary | Join key | Clock type |
|---|---|---|---|---|---|---|---|
| Service discovery | all | -- | none in current clients | -- | -- | -- | -- |
| Stream discovery | without-aggregator, notification-aggregator | `stream_discovery` | client | metadata request | metadata response | stream_id | local monotonic |
| Query reuse check | heimdall | service `initialization.csv` | Heimdall | service-defined | service-defined | query_id | service local |
| Service authentication/authorization | heimdall | service initialization raw records when emitted | Heimdall | service-defined | service-defined | query_id | service local |
| Query registration | heimdall | service `initialization.csv` | Heimdall | service-defined | service-defined | query_id | service local |
| Stream subscription | without-aggregator, notification-aggregator | `stream_subscription` | client | request/send | response/send completion | stream_id | local monotonic |
| WebSocket message | heimdall | client messages + Heimdall initialization | client/service | client send | server receive | query_id,message_id | cross-machine; requires verified sync |
| Event retrieval | without-aggregator | `event_retrieval` | client | GET event URL | HTTP response | event_id | local monotonic |
| Parsing and timestamp extraction | without-aggregator, notification-aggregator | `parsing_timestamp_extraction` | client | parse start | timestamp extracted | event_id | local monotonic |
| Insertion into RSP engine | without-aggregator, notification-aggregator, heimdall | `rsp_insertion` | canonical RSP-JS | `RDFStream.add` | insertion callback | event_id,stream_id | local monotonic |
| Window-query processing | without-aggregator, notification-aggregator, heimdall | `window_query_processing` | canonical RSP-JS | R2R execute | bindings end | window_id | local monotonic |
| Result delivery | heimdall | client results + service `result-dispatch.csv` | server/client | server send | client receive | result_id | cross-machine; requires verified sync |

`--` means the operation is not implemented by that architecture or is not observable in the current client, not a zero-duration measurement. Notification delivery carries no retrieval request in this architecture, so it has no `event_retrieval` measurement. Locally evaluated results do not have an explicit service-to-client result-dispatch stage.

## Colocated multi-client readiness

The empirical colocated experiment adds `registration_to_first_result` without
changing `r2r_first_result`. The start and end timestamps are both from the
same client process monotonic clock. A client writes
`client-N-first-result.ready` only after observing its first result binding.

The readiness protocol is deliberately fail-closed:

- Heimdall clients require a JSON acknowledgement such as
  `{"type":"ready","status":"ready","query_id":"..."}` after the
  service has accepted and initialized that query connection.
- Notifications Aggregator clients require one explicit acknowledgement per
  stream, such as
  `{"type":"subscription_ready","stream":"..."}`, after the service's
  `subscribe_inbox()` operation completes. Three WebSocket sends alone are not
  sufficient.
- Without Aggregator clients use the successful response from each Solid
  subscription-establishment POST. The current code checks the HTTP 2xx result
  returned by that establishment endpoint; it performs no duplicate event GET.

The deployed Heimdall and Notifications Aggregator services must emit these
acknowledgements before a smoke or final run. The evaluator does not infer
readiness from a client send, a remote timestamp, or the first result itself.

Out-of-order records are one logical event, never one RDF quad: `out_of_order_event` stores `event_id`, `lateness_ms`, `within_bound`, and `max_out_of_orderness_ms`. A late event is within the 30,000 ms bound when `lateness_ms <= 30000`.
