#!/usr/bin/env node

/* Raw-data reducer. It is separate from benchmark.js so the runner emits no statistics. */
const fs = require("fs");
const path = require("path");

const OPERATIONS = ["service_discovery", "service_authentication", "stream_discovery"];

function parseCsvLine(line) {
    const values = [];
    let value = "", quoted = false;
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
            if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
            else quoted = !quoted;
        } else if (char === "," && !quoted) { values.push(value); value = ""; }
        else value += char;
    }
    values.push(value);
    return values;
}

function readRows(inputPath) {
    const lines = fs.readFileSync(inputPath, "utf8").trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error("Initialization CSV has no observations.");
    const header = parseCsvLine(lines[0]);
    return lines.slice(1).map(line => Object.fromEntries(parseCsvLine(line).map((value, index) => [header[index], value])));
}

function quartile(values, probability) {
    const sorted = [...values].sort((a, b) => a - b);
    const position = probability * (sorted.length - 1);
    const lower = Math.floor(position), upper = Math.ceil(position);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function stats(values) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
    const q1 = quartile(values, 0.25), q3 = quartile(values, 0.75);
    return { N: values.length, mean_ms: mean, sd_ms: Math.sqrt(variance), median_ms: quartile(values, 0.5), q1_ms: q1, q3_ms: q3, iqr_ms: q3 - q1 };
}

function fixed(value) { return value.toFixed(6); }
function csv(value) {
    const text = value === undefined || value === null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function main() {
    const inputPath = process.env.INITIALIZATION_BENCHMARK_INPUT || process.argv[2] || "initialization-benchmark.csv";
    const outputDirectory = process.env.INITIALIZATION_ANALYSIS_OUTPUT || process.argv[3] || path.dirname(inputPath);
    const rows = readRows(inputPath);
    const repetitions = [...new Set(rows.map(row => Number(row.repetition)))].sort((a, b) => a - b);
    if (repetitions.length !== 35 || repetitions[0] !== 1 || repetitions[34] !== 35) throw new Error("Analysis requires exactly 35 repetitions numbered 1 through 35.");
    if (rows.length !== 105 || rows.some(row => !OPERATIONS.includes(row.operation))) throw new Error("Analysis requires exactly 105 rows: three known operations per repetition.");
    for (const repetition of repetitions) {
        const count = rows.filter(row => Number(row.repetition) === repetition).length;
        if (count !== OPERATIONS.length) throw new Error(`Repetition ${repetition} does not contain exactly three observations.`);
    }
    const summary = OPERATIONS.map(operation => {
        const retained = rows.filter(row => row.operation === operation && Number(row.repetition) >= 4 && Number(row.repetition) <= 33);
        if (retained.length !== 30 || retained.some(row => row.success !== "true")) throw new Error(`${operation} does not have 30 successful retained observations.`);
        return { operation, ...stats(retained.map(row => Number(row.duration_ms))) };
    });
    fs.mkdirSync(outputDirectory, { recursive: true });
    const fields = ["operation", "N", "mean_ms", "sd_ms", "median_ms", "q1_ms", "q3_ms", "iqr_ms", "latex_value"];
    const records = summary.map(row => ({ ...row, latex_value: `\\shortstack{$${fixed(row.mean_ms)} \\pm ${fixed(row.sd_ms)}$\\\\$${fixed(row.median_ms)}\\,[${fixed(row.q1_ms)},\\,${fixed(row.q3_ms)}]$}` }));
    fs.writeFileSync(path.join(outputDirectory, "initialization-benchmark-summary.csv"), `${fields.join(",")}\n${records.map(row => fields.map(field => csv(row[field])).join(",")).join("\n")}\n`);
    fs.writeFileSync(path.join(outputDirectory, "initialization-benchmark-table.tex"), `${records.map(row => `${row.operation.replace(/_/g, "\\_")} & ${row.latex_value} \\\\`).join("\n")}\n`);
    console.log(JSON.stringify(records, null, 2));
}

if (require.main === module) {
    try { main(); }
    catch (error) { console.error(`Initialization analysis failed: ${error.message}`); process.exitCode = 1; }
}

module.exports = { parseCsvLine, quartile, stats };
