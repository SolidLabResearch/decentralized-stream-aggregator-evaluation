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
    let max = -Infinity;
    for (let i = 0; i < values.length; i++) {
        if (values[i] > max) {
            max = values[i];
        }
    }
    return max;
}

export function find_minimum(values: number[]): number {    
    let min = Infinity;
    for (let i = 0; i < values.length; i++) {
        if (values[i] < min) {
            min = values[i];
        }
    }
    return min;
}

export function calculate_sum(values: number[]): number {
    return values.reduce((acc, val) => acc + val, 0);
}