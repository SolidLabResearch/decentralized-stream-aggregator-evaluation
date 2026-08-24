import * as path from "path";
import { launchConfiguredClients } from "../shared/runtime";
launchConfiguredClients("notification-aggregator", path.resolve(__dirname, "client.ts"));
