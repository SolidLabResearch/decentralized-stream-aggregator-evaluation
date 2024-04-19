import { calculate_mean, calculate_standard_deviation } from '../../util/Util';
// for the without aggregator
const evaluation_time = [(1713447301370 - 1713447300375), (1713447361202 - 1713447360705), (1713447421842 - 1713447421246), (1713447481699 - 1713447480996), (1713447542077 - 1713447541350)];
console.log(calculate_mean(evaluation_time));
console.log(calculate_standard_deviation(evaluation_time));

// for the with notifications aggregator

const evaluation_time_with_notifications = [(1713450061277 - 1713450060325), (1713450120625 - 1713450120223), (1713450181889 - 1713450181082), (1713450243827 - 1713450243171), (1713450302296 - 1713450301513)];
console.log(calculate_mean(evaluation_time_with_notifications));
console.log(calculate_standard_deviation(evaluation_time_with_notifications));

// with aggregator


const evaluation_time_with_aggregator = [(1713453661231 - 1713453660270), (1713453721346 - 1713453720811), (1713453782644 - 1713453781902), (1713453841889 - 1713453841204), (1713453902218 - 1713453901475)];

console.log(calculate_mean(evaluation_time_with_aggregator));
console.log(calculate_standard_deviation(evaluation_time_with_aggregator));