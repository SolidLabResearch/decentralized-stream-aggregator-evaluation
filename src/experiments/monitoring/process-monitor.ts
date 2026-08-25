import * as fs from "fs";

export interface ProcessMonitor { stop(): Promise<void>; }

export function monitorCurrentProcess(filePath: string, intervalMs: number): ProcessMonitor {
    const output = fs.createWriteStream(filePath, { flags: "w" });
    output.write("timestamp,cpu_user,cpu_system,rss,heapTotal,heapUsed,external,cpu_user_delta_us,cpu_system_delta_us,wall_delta_us,cpu_utilization_percent\n");
    let previousCpu = process.cpuUsage();
    let previousWall = process.hrtime.bigint();
    const sample = () => {
        const cpu = process.cpuUsage();
        const memory = process.memoryUsage();
        const wall = process.hrtime.bigint();
        const wallDeltaUs = Number(wall - previousWall) / 1_000;
        const userDeltaUs = cpu.user - previousCpu.user;
        const systemDeltaUs = cpu.system - previousCpu.system;
        const utilization = wallDeltaUs > 0 ? 100 * (userDeltaUs + systemDeltaUs) / wallDeltaUs : "";
        output.write(`${Date.now()},${cpu.user},${cpu.system},${memory.rss},${memory.heapTotal},${memory.heapUsed},${memory.external},${userDeltaUs},${systemDeltaUs},${wallDeltaUs},${utilization}\n`);
        previousCpu = cpu;
        previousWall = wall;
    };
    sample();
    const interval = setInterval(sample, intervalMs);
    return { stop: () => new Promise((resolve) => { clearInterval(interval); output.end(resolve); }) };
}
