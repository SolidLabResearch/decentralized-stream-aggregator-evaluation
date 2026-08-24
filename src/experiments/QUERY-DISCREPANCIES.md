# Historical query discrepancy

The three historical **4 Hz entrypoints** (`4Hz/1client.ts`, and the matching
numbered files) delegate to utilities whose query uses a 60-second range and a
20-second step. The shared builder uses that range/step. It uses the namespace
spelling from the historical child-process Heimdall client and the without-
aggregator utility (`https://rsp.js/`), not the no-trailing-slash spelling in
the two historical in-process generators. This spelling discrepancy has not
been experimentally adjudicated; it is a compatibility TODO, not a scientific
query correction. The existing `acceleration.x` property predicate in all
three windows is deliberately preserved.

`src/increasing-number-of-clients/with-notification-aggregator/util/child-process-client.ts`
contains a different, older child-process implementation with a 30-second
step. It is not what the historical 4 Hz entrypoint calls. It remains untouched
for reproduction; this refactor does not infer that it should supersede the
4 Hz entrypoint query.
