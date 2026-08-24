import * as assert from "assert";
import * as path from "path";
import { initializationTargets, treePath } from "../initialise-LDES";

process.env.EXPERIMENT_CONFIG_PATH = path.resolve(__dirname, "../src/experiments/config/experiment-config.n079.test.json");

assert.deepStrictEqual(initializationTargets(), [
    "http://n079-11.wall1.ilabt.imec.be:3000/pod1/acc-x/",
    "http://n079-11.wall1.ilabt.imec.be:3000/pod1/acc-y/",
    "http://n079-11.wall1.ilabt.imec.be:3000/pod1/acc-z/"
]);
assert.strictEqual(treePath, "https://saref.etsi.org/core/hasTimestamp");
console.log("initialise-LDES n079 configuration test passed");
