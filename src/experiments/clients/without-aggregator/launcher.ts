import * as path from "path";
import { launchConfiguredClients } from "../shared/runtime";
launchConfiguredClients("without-aggregator", path.resolve(__dirname, "client.ts"));
