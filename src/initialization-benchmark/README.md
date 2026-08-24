# Standalone initialization benchmark

This benchmark is independent of the 4 Hz experiment. It does not load the
experiment configuration and does not start RSP-JS, a replayer, or Heimdall.

## Provision the public service description

Create the CSS client-credentials token before this step. Put its issuer,
client ID, and secret only in the shell environment:

```sh
export SOLID_POD_URL='http://n079-11.wall1.ilabt.imec.be:3000/pod1/'
export SOLID_OIDC_ISSUER='http://n079-11.wall1.ilabt.imec.be:3000/'
export SOLID_CLIENT_ID='...'
export SOLID_CLIENT_SECRET='...'
export EXPECTED_HEIMDALL_WS_URL='ws://n079-09.wall1.ilabt.imec.be:8080/'
npm run benchmark:init:provision
```

The provisioner writes `service-description.ttl` using an authenticated PUT,
then verifies that the resource can be fetched publicly and resolves to the
expected endpoint. The resource is represented as RDF/Turtle with a
`schema:Service` named `Heimdall` and `heimdall:webSocketEndpoint`.

## Smoke and 35 repetitions

Set the expected stream URLs before running. These values are validation
expectations, not discovery input:

```sh
export EXPECTED_STREAM_X_URL='http://n079-11.wall1.ilabt.imec.be:3000/pod1/acc-x/'
export EXPECTED_STREAM_Y_URL='http://n079-11.wall1.ilabt.imec.be:3000/pod1/acc-y/'
export EXPECTED_STREAM_Z_URL='http://n079-11.wall1.ilabt.imec.be:3000/pod1/acc-z/'
npm run benchmark:init:smoke -- --output initialization-smoke.csv
npm run benchmark:init -- --output initialization-benchmark.csv
```

The smoke run proves the public RDF endpoint, real CSS client-credentials
authentication, and five authenticated discovery requests (profile, type
index, and three stream metadata resources). The full runner writes only raw
observations. It creates a fresh authenticated session and cache-buster for
each repetition and supports exactly one smoke repetition or 35 campaign
repetitions.

## Analysis

```sh
npm run analyze:initialization-benchmark -- initialization-benchmark.csv initialization-analysis
```

The reducer discards repetitions 1–3 and 34–35, retains 4–33, uses sample
standard deviation and inclusive `p*(n-1)` linear-interpolation quartiles, and
writes the summary CSV and LaTeX table outside the raw benchmark file. The raw
authentication row also includes `authenticated_session=true` only after the
token exchange and authenticated profile confirmation have both succeeded.
