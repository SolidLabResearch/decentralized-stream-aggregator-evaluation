import * as fs from "fs";
import * as os from "os";

export interface HostMonitor { stop(): Promise<void>; }

export type CpuSample = { user: number; nice: number; system: number; idle: number; iowait: number; irq: number; softirq: number; steal: number; total: number };

export function parseProcStat(text: string): CpuSample {
    const line = text.split("\n").find((value) => /^cpu\s/.test(value));
    if (!line) throw new Error("/proc/stat does not contain an aggregate CPU row.");
    const values = line.trim().split(/\s+/).slice(1).map(Number);
    const [user = 0, nice = 0, system = 0, idle = 0, iowait = 0, irq = 0, softirq = 0, steal = 0] = values;
    return { user, nice, system, idle, iowait, irq, softirq, steal, total: values.reduce((sum, value) => sum + value, 0) };
}
function cpuSample(): CpuSample { return parseProcStat(fs.readFileSync("/proc/stat", "utf8")); }

function memorySample(): { total: number; available: number; used: number } {
    const values = new Map(fs.readFileSync("/proc/meminfo", "utf8").split("\n").map((line) => {
        const match = /^(MemTotal|MemAvailable):\s+(\d+)\s+kB$/.exec(line);
        return match ? [match[1], Number(match[2]) * 1024] as [string, number] : ["", 0] as [string, number];
    }).filter(([key]) => key));
    const total = values.get("MemTotal") || 0;
    const available = values.get("MemAvailable") || 0;
    return { total, available, used: total - available };
}

export function monitorHostResources(filePath: string, intervalMs: number): HostMonitor {
    const output = fs.createWriteStream(filePath, { flags: "w" });
    output.write("timestamp,cpu_user,cpu_nice,cpu_system,cpu_idle,cpu_iowait,cpu_irq,cpu_softirq,cpu_steal,host_cpu_utilization_percent,host_cpu_one_core_equivalents_percent,mem_total_bytes,mem_available_bytes,mem_used_bytes\n");
    let previous = cpuSample();
    const sample = () => {
        const current = cpuSample();
        const totalDelta = current.total - previous.total;
        const previousIdle = previous.idle + previous.iowait;
        const currentIdle = current.idle + current.iowait;
        const busyDelta = (current.total - currentIdle) - (previous.total - previousIdle);
        const utilization = totalDelta > 0 ? 100 * busyDelta / totalDelta : "";
        const memory = memorySample();
        output.write(`${Date.now()},${current.user},${current.nice},${current.system},${current.idle},${current.iowait},${current.irq},${current.softirq},${current.steal},${utilization},${totalDelta > 0 ? 100 * busyDelta / Math.max(1, totalDelta / Math.max(1, os.cpus().length)) : ""},${memory.total},${memory.available},${memory.used}\n`);
        previous = current;
    };
    sample();
    const interval = setInterval(sample, intervalMs);
    return { stop: () => new Promise((resolve) => { clearInterval(interval); output.end(resolve); }) };
}
