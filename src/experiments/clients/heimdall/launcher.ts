import * as path from "path";
import { launchConfiguredClients } from "../shared/runtime";
launchConfiguredClients("heimdall", path.resolve(__dirname, "client.ts"));
