import * as fs from "fs";
import * as path from "path";

const baseDownloadsPath = "/Users/kushbisen/Downloads/1client";
const CPU_CORES = 24; // Server has 24 logical CPUs (same as without aggregator analysis)

interface ResourceData {
    timestamp: number;
    cpu_user: number;
    rss: number;          // Resident Set Size (physical memory)
    heapTotal: number;    // Total heap allocated
    heapUsed: number;     // Heap memory used
    external: number;     // External memory
}

interface IterationResourceMetrics {
    iteration: number;
    totalDataPoints: number;
    durationMinutes: number;
    durationSeconds: number;
    // CPU metrics (as percentages, matching without aggregator methodology)
    avgCpuUserPercent: number;
    maxCpuUserPercent: number;
    avgCpuUserPerCorePercent: number;
    maxCpuUserPerCorePercent: number;
    stdDevCpuUserPercent: number;
    // Memory metrics (in MB)
    avgRssMemoryMB: number;
    maxRssMemoryMB: number;
    minRssMemoryMB: number;
    stdDevRssMemoryMB: number;
    avgHeapUsedMB: number;
    maxHeapUsedMB: number;
    minHeapUsedMB: number;
    stdDevHeapUsedMB: number;
    avgHeapTotalMB: number;
    maxHeapTotalMB: number;
    avgExternalMB: number;
    heapUtilizationPercent: number; // heap used / heap total * 100
}

function bytesToMB(bytes: number): number {
    return bytes / (1024 * 1024);
}

function parseResourceCSV(filePath: string): ResourceData[] {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    // Skip header line
    const dataLines = lines.slice(1);
    
    return dataLines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
            timestamp: parseInt(parts[0]),
            cpu_user: parseInt(parts[1]),
            rss: parseInt(parts[2]),
            heapTotal: parseInt(parts[3]),
            heapUsed: parseInt(parts[4]),
            external: parseInt(parts[5])
        };
    }).filter(data => !isNaN(data.timestamp));
}

function calculateResourceMetrics(data: ResourceData[], iteration: number): IterationResourceMetrics {
    if (data.length === 0) {
        return {
            iteration,
            totalDataPoints: 0,
            durationMinutes: 0,
            durationSeconds: 0,
            avgCpuUserPercent: 0,
            maxCpuUserPercent: 0,
            avgCpuUserPerCorePercent: 0,
            maxCpuUserPerCorePercent: 0,
            stdDevCpuUserPercent: 0,
            avgRssMemoryMB: 0,
            maxRssMemoryMB: 0,
            minRssMemoryMB: 0,
            stdDevRssMemoryMB: 0,
            avgHeapUsedMB: 0,
            maxHeapUsedMB: 0,
            minHeapUsedMB: 0,
            stdDevHeapUsedMB: 0,
            avgHeapTotalMB: 0,
            maxHeapTotalMB: 0,
            avgExternalMB: 0,
            heapUtilizationPercent: 0
        };
    }
    
    // Calculate duration
    const startTime = Math.min(...data.map(d => d.timestamp));
    const endTime = Math.max(...data.map(d => d.timestamp));
    const durationSeconds = (endTime - startTime) / 1000;
    const durationMinutes = durationSeconds / 60;
    
    // Calculate CPU percentages using the same methodology as without aggregator analysis
    // CPU values are cumulative, so we calculate the difference between consecutive readings
    // Formula: ((cpu_user_diff/1000)/500)*100 where cpu_user_diff is the difference
    const cpuUserPercents: number[] = [];
    
    for (let i = 1; i < data.length; i++) {
        const userDiff = data[i].cpu_user - data[i-1].cpu_user; // microseconds of CPU time used
        
        // Apply the same formula as without aggregator analysis: ((E_value/1000)/500)*100
        const userPercent = ((userDiff / 1000) / 500) * 100;
        
        // Ensure non-negative values and cap extreme values
        const userCapped = Math.max(0, Math.min(userPercent, 1000)); // Cap at 1000% to handle anomalies
        cpuUserPercents.push(userCapped);
    }
    
    // If we have no measurements, use zero
    if (cpuUserPercents.length === 0) {
        cpuUserPercents.push(0);
    }
    
    // Convert memory to MB
    const rssMB = data.map(d => d.rss / (1024 * 1024));
    const heapUsedMB = data.map(d => d.heapUsed / (1024 * 1024));
    const heapTotalMB = data.map(d => d.heapTotal / (1024 * 1024));
    const externalMB = data.map(d => d.external / (1024 * 1024));
    
    // Calculate heap utilization percentages
    const heapUtilizations = data.map(d => (d.heapUsed / d.heapTotal) * 100);
    
    // Calculate statistics
    const avgCpuUserPercent = cpuUserPercents.reduce((sum, val) => sum + val, 0) / cpuUserPercents.length;
    const maxCpuUserPercent = Math.max(...cpuUserPercents);
    const stdDevCpuUserPercent = Math.sqrt(cpuUserPercents.map(val => Math.pow(val - avgCpuUserPercent, 2)).reduce((sum, sq) => sum + sq, 0) / cpuUserPercents.length);
    
    const avgRssMemoryMB = rssMB.reduce((sum, val) => sum + val, 0) / rssMB.length;
    const maxRssMemoryMB = Math.max(...rssMB);
    const minRssMemoryMB = Math.min(...rssMB);
    const stdDevRssMemoryMB = Math.sqrt(rssMB.map(val => Math.pow(val - avgRssMemoryMB, 2)).reduce((sum, sq) => sum + sq, 0) / rssMB.length);
    
    const avgHeapUsedMB = heapUsedMB.reduce((sum, val) => sum + val, 0) / heapUsedMB.length;
    const maxHeapUsedMB = Math.max(...heapUsedMB);
    const minHeapUsedMB = Math.min(...heapUsedMB);
    const stdDevHeapUsedMB = Math.sqrt(heapUsedMB.map(val => Math.pow(val - avgHeapUsedMB, 2)).reduce((sum, sq) => sum + sq, 0) / heapUsedMB.length);
    
    const avgHeapTotalMB = heapTotalMB.reduce((sum, val) => sum + val, 0) / heapTotalMB.length;
    const maxHeapTotalMB = Math.max(...heapTotalMB);
    const avgExternalMB = externalMB.reduce((sum, val) => sum + val, 0) / externalMB.length;
    const heapUtilizationPercent = heapUtilizations.reduce((sum, val) => sum + val, 0) / heapUtilizations.length;
    
    return {
        iteration,
        totalDataPoints: data.length,
        durationMinutes,
        durationSeconds,
        avgCpuUserPercent,
        maxCpuUserPercent,
        avgCpuUserPerCorePercent: avgCpuUserPercent / CPU_CORES,
        maxCpuUserPerCorePercent: maxCpuUserPercent / CPU_CORES,
        stdDevCpuUserPercent,
        avgRssMemoryMB,
        maxRssMemoryMB,
        minRssMemoryMB,
        stdDevRssMemoryMB,
        avgHeapUsedMB,
        maxHeapUsedMB,
        minHeapUsedMB,
        stdDevHeapUsedMB,
        avgHeapTotalMB,
        maxHeapTotalMB,
        avgExternalMB,
        heapUtilizationPercent
    };
}

function calculateStats(values: number[]): { mean: number; stdDev: number; min: number; max: number } {
    if (values.length === 0) return { mean: 0, stdDev: 0, min: 0, max: 0 };
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return { mean, stdDev, min, max };
}

async function analyzeCpuMemoryUsage() {
    console.log("=== CPU AND MEMORY USAGE ANALYSIS - AGGREGATOR APPROACH (30 ITERATIONS) ===");
    console.log("Analyzing iterations 4-33 (filtered, excluding first 3 and last 2)\n");
    
    const allMetrics: IterationResourceMetrics[] = [];
    
    // Process iterations 4-33 (30 iterations)
    for (let i = 4; i <= 33; i++) {
        const aggregatorLogsDir = path.join(baseDownloadsPath, i.toString(), "aggregator_logs");
        
        if (fs.existsSync(aggregatorLogsDir)) {
            const csvFiles = fs.readdirSync(aggregatorLogsDir).filter(f => 
                f.includes('aggregator_resource_used') && f.endsWith('.csv')
            );
            
            // Find the CSV file with the most data
            let largestCsvFile = "";
            let largestSize = 0;
            
            for (const csvFile of csvFiles) {
                const fullPath = path.join(aggregatorLogsDir, csvFile);
                const stats = fs.statSync(fullPath);
                if (stats.size > largestSize) {
                    largestSize = stats.size;
                    largestCsvFile = fullPath;
                }
            }
            
            if (largestCsvFile) {
                console.log(`Processing iteration ${i}: ${path.basename(largestCsvFile)}`);
                const resourceData = parseResourceCSV(largestCsvFile);
                const metrics = calculateResourceMetrics(resourceData, i);
                allMetrics.push(metrics);
                
                console.log(`  - Data points: ${metrics.totalDataPoints}`);
                console.log(`  - Duration: ${metrics.durationMinutes.toFixed(2)} minutes`);
                console.log(`  - Avg CPU: ${metrics.avgCpuUserPercent.toFixed(2)}%`);
                console.log(`  - Avg CPU per Core: ${metrics.avgCpuUserPerCorePercent.toFixed(2)}%`);
                console.log(`  - Avg RSS Memory: ${metrics.avgRssMemoryMB.toFixed(2)} MB`);
                console.log(`  - Avg Heap Used: ${metrics.avgHeapUsedMB.toFixed(2)} MB`);
                console.log(`  - Heap Utilization: ${metrics.heapUtilizationPercent.toFixed(1)}%`);
            } else {
                console.log(`Iteration ${i}: No resource CSV files found`);
            }
        } else {
            console.log(`Iteration ${i}: Directory not found`);
        }
    }
    
    if (allMetrics.length === 0) {
        console.log("No valid CPU/Memory metrics found!");
        return;
    }
    
    // Calculate Aggregate Statistics
    console.log(`\n=== CPU AND MEMORY STATISTICS (${allMetrics.length} iterations) ===`);
    
    // Extract values for statistical analysis
    const dataPoints = allMetrics.map(m => m.totalDataPoints);
    const durations = allMetrics.map(m => m.durationMinutes);
    const avgCpuUserPercents = allMetrics.map(m => m.avgCpuUserPercent);
    const maxCpuUserPercents = allMetrics.map(m => m.maxCpuUserPercent);
    const avgCpuUserPerCorePercents = allMetrics.map(m => m.avgCpuUserPerCorePercent);
    const maxCpuUserPerCorePercents = allMetrics.map(m => m.maxCpuUserPerCorePercent);
    const avgRssMemory = allMetrics.map(m => m.avgRssMemoryMB);
    const maxRssMemory = allMetrics.map(m => m.maxRssMemoryMB);
    const avgHeapUsed = allMetrics.map(m => m.avgHeapUsedMB);
    const maxHeapUsed = allMetrics.map(m => m.maxHeapUsedMB);
    const avgHeapTotal = allMetrics.map(m => m.avgHeapTotalMB);
    const heapUtilizations = allMetrics.map(m => m.heapUtilizationPercent);
    
    // Calculate statistics
    const dataPointStats = calculateStats(dataPoints);
    const durationStats = calculateStats(durations);
    const avgCpuStats = calculateStats(avgCpuUserPercents);
    const maxCpuStats = calculateStats(maxCpuUserPercents);
    const avgCpuPerCoreStats = calculateStats(avgCpuUserPerCorePercents);
    const maxCpuPerCoreStats = calculateStats(maxCpuUserPerCorePercents);
    const avgRssStats = calculateStats(avgRssMemory);
    const maxRssStats = calculateStats(maxRssMemory);
    const avgHeapUsedStats = calculateStats(avgHeapUsed);
    const maxHeapUsedStats = calculateStats(maxHeapUsed);
    const avgHeapTotalStats = calculateStats(avgHeapTotal);
    const heapUtilizationStats = calculateStats(heapUtilizations);
    
    console.log(`\n📊 DATA COLLECTION METRICS:`);
    console.log(`   Data points per iteration: ${dataPointStats.mean.toFixed(0)} (±${dataPointStats.stdDev.toFixed(0)})`);
    console.log(`   Range: ${dataPointStats.min} - ${dataPointStats.max} data points`);
    console.log(`   Monitoring duration: ${durationStats.mean.toFixed(2)} minutes (±${durationStats.stdDev.toFixed(2)})`);
    
    console.log(`\n🖥️  CPU USAGE ANALYSIS:`);
    console.log(`   Average CPU User: ${avgCpuStats.mean.toFixed(2)}% (±${avgCpuStats.stdDev.toFixed(2)}%)`);
    console.log(`   Range: ${avgCpuStats.min.toFixed(2)}% - ${avgCpuStats.max.toFixed(2)}%`);
    console.log(`   Average CPU per Core: ${avgCpuPerCoreStats.mean.toFixed(2)}% (±${avgCpuPerCoreStats.stdDev.toFixed(2)}%)`);
    console.log(`   Peak CPU User: ${maxCpuStats.mean.toFixed(2)}% (±${maxCpuStats.stdDev.toFixed(2)}%)`);
    console.log(`   Peak CPU per Core: ${maxCpuPerCoreStats.mean.toFixed(2)}% (±${maxCpuPerCoreStats.stdDev.toFixed(2)}%)`);
    console.log(`   Peak Range: ${maxCpuStats.min.toFixed(2)}% - ${maxCpuStats.max.toFixed(2)}%`);
    
    console.log(`\n🧠 PHYSICAL MEMORY (RSS) ANALYSIS:`);
    console.log(`   Average RSS Memory: ${avgRssStats.mean.toFixed(2)} MB (±${avgRssStats.stdDev.toFixed(2)})`);
    console.log(`   Range: ${avgRssStats.min.toFixed(2)} - ${avgRssStats.max.toFixed(2)} MB`);
    console.log(`   Peak RSS Memory: ${maxRssStats.mean.toFixed(2)} MB (±${maxRssStats.stdDev.toFixed(2)})`);
    console.log(`   Peak Range: ${maxRssStats.min.toFixed(2)} - ${maxRssStats.max.toFixed(2)} MB`);
    
    console.log(`\n📦 HEAP MEMORY ANALYSIS:`);
    console.log(`   Average Heap Used: ${avgHeapUsedStats.mean.toFixed(2)} MB (±${avgHeapUsedStats.stdDev.toFixed(2)})`);
    console.log(`   Range: ${avgHeapUsedStats.min.toFixed(2)} - ${avgHeapUsedStats.max.toFixed(2)} MB`);
    console.log(`   Peak Heap Used: ${maxHeapUsedStats.mean.toFixed(2)} MB (±${maxHeapUsedStats.stdDev.toFixed(2)})`);
    console.log(`   Average Heap Total: ${avgHeapTotalStats.mean.toFixed(2)} MB (±${avgHeapTotalStats.stdDev.toFixed(2)})`);
    
    console.log(`\n⚡ MEMORY EFFICIENCY:`);
    console.log(`   Heap Utilization: ${heapUtilizationStats.mean.toFixed(1)}% (±${heapUtilizationStats.stdDev.toFixed(1)}%)`);
    console.log(`   Range: ${heapUtilizationStats.min.toFixed(1)}% - ${heapUtilizationStats.max.toFixed(1)}%`);
    
    // Resource Usage Summary Table
    console.log(`\n📈 RESOURCE USAGE SUMMARY TABLE:`);
    console.log(`| Metric | Average | Min | Max | Std Dev |`);
    console.log(`|--------|---------|-----|-----|---------|`);
    console.log(`| Data points | ${dataPointStats.mean.toFixed(0)} | ${dataPointStats.min} | ${dataPointStats.max} | ±${dataPointStats.stdDev.toFixed(0)} |`);
    console.log(`| Duration (min) | ${durationStats.mean.toFixed(2)} | ${durationStats.min.toFixed(2)} | ${durationStats.max.toFixed(2)} | ±${durationStats.stdDev.toFixed(2)} |`);
    console.log(`| CPU User (%) | ${avgCpuStats.mean.toFixed(2)} | ${avgCpuStats.min.toFixed(2)} | ${avgCpuStats.max.toFixed(2)} | ±${avgCpuStats.stdDev.toFixed(2)} |`);
    console.log(`| CPU per Core (%) | ${avgCpuPerCoreStats.mean.toFixed(2)} | ${avgCpuPerCoreStats.min.toFixed(2)} | ${avgCpuPerCoreStats.max.toFixed(2)} | ±${avgCpuPerCoreStats.stdDev.toFixed(2)} |`);
    console.log(`| RSS Memory (MB) | ${avgRssStats.mean.toFixed(2)} | ${avgRssStats.min.toFixed(2)} | ${avgRssStats.max.toFixed(2)} | ±${avgRssStats.stdDev.toFixed(2)} |`);
    console.log(`| Heap Used (MB) | ${avgHeapUsedStats.mean.toFixed(2)} | ${avgHeapUsedStats.min.toFixed(2)} | ${avgHeapUsedStats.max.toFixed(2)} | ±${avgHeapUsedStats.stdDev.toFixed(2)} |`);
    console.log(`| Heap Total (MB) | ${avgHeapTotalStats.mean.toFixed(2)} | ${avgHeapTotalStats.min.toFixed(2)} | ${avgHeapTotalStats.max.toFixed(2)} | ±${avgHeapTotalStats.stdDev.toFixed(2)} |`);
    console.log(`| Heap Utilization (%) | ${heapUtilizationStats.mean.toFixed(1)} | ${heapUtilizationStats.min.toFixed(1)} | ${heapUtilizationStats.max.toFixed(1)} | ±${heapUtilizationStats.stdDev.toFixed(1)} |`);
    
    // Overall Resource Efficiency
    const totalDataPoints = allMetrics.reduce((sum, m) => sum + m.totalDataPoints, 0);
    const totalDuration = allMetrics.reduce((sum, m) => sum + m.durationMinutes, 0);
    
    console.log(`\n🎯 OVERALL RESOURCE SUMMARY (30 iterations combined):`);
    console.log(`   Total monitoring data points: ${totalDataPoints.toLocaleString()}`);
    console.log(`   Total monitoring time: ${(totalDuration / 60).toFixed(2)} hours`);
    console.log(`   Average monitoring per iteration: ${(totalDuration / allMetrics.length).toFixed(2)} minutes`);
    console.log(`   Data collection frequency: ${(totalDataPoints / totalDuration).toFixed(1)} samples/minute`);
    
    // Performance Insights
    console.log(`\n💡 PERFORMANCE INSIGHTS:`);
    
    const cpuMicrosecondsToPercent = (microseconds: number, durationMinutes: number) => {
        // Rough conversion: CPU microseconds over time period
        const totalMicroseconds = durationMinutes * 60 * 1000000;
        return (microseconds / totalMicroseconds) * 100;
    };
    
    const avgCpuPercent = cpuMicrosecondsToPercent(avgCpuStats.mean, durationStats.mean);
    
    console.log(`   🖥️  CPU Usage: ~${avgCpuPercent.toFixed(3)}% average utilization`);
    console.log(`   🧠 Memory Stability: ${avgRssStats.stdDev < 10 ? 'Excellent' : avgRssStats.stdDev < 50 ? 'Good' : 'Variable'} (±${avgRssStats.stdDev.toFixed(2)} MB variation)`);
    console.log(`   📦 Heap Efficiency: ${heapUtilizationStats.mean.toFixed(1)}% utilization (${heapUtilizationStats.mean > 70 ? 'Efficient' : heapUtilizationStats.mean > 50 ? 'Moderate' : 'Conservative'})`);
    console.log(`   ⚡ Resource Consistency: ${avgCpuStats.stdDev < avgCpuStats.mean * 0.1 ? 'Excellent' : 'Good'} CPU stability`);
    
    if (avgRssStats.mean < 500) {
        console.log(`   💚 Memory Footprint: Lightweight (${avgRssStats.mean.toFixed(0)}MB average)`);
    } else if (avgRssStats.mean < 1000) {
        console.log(`   💛 Memory Footprint: Moderate (${avgRssStats.mean.toFixed(0)}MB average)`);
    } else {
        console.log(`   🔶 Memory Footprint: Heavy (${avgRssStats.mean.toFixed(0)}MB average)`);
    }
}

analyzeCpuMemoryUsage();
