export function calculate_mean(values: number[]): number {
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
}

export function calculate_standard_deviation(values: number[]): number {
    const mean = calculate_mean(values);
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    const sumSquaredDiff = squaredDifferences.reduce((acc, val) => acc + val, 0);
    return Math.sqrt(sumSquaredDiff / values.length);
}

export function find_maximum(values: number[]): number {
    return Math.max(...values);
}

export function find_minimum(values: number[]): number {
    return Math.min(...values);
}   

export function calculate_sum(values: number[]): number {
    return values.reduce((acc, val) => acc + val, 0);
}