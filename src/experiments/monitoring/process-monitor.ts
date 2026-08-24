import * as fs from "fs";

export interface ProcessMonitor { stop(): Promise<void>; }

export function monitorCurrentProcess(filePath: string, intervalMs: number): ProcessMonitor {
    const output = fs.createWriteStream(filePath, { flags: "w" });
    output.write("timestamp,cpu_user,cpu_system,rss,heapTotal,heapUsed,external\n");
    const sample = () => {
        const cpu = process.cpuUsage();
        const memory = process.memoryUsage();
        output.write(`${Date.now()},${cpu.user},${cpu.system},${memory.rss},${memory.heapTotal},${memory.heapUsed},${memory.external}\n`);
    };
    sample();
    const interval = setInterval(sample, intervalMs);
    return { stop: () => new Promise((resolve) => { clearInterval(interval); output.end(resolve); }) };
}
