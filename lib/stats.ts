// Statistical helpers — pure functions, no I/O.
//
// All operate on number arrays. Empty input returns 0 (or NaN where
// statistically meaningful, e.g. stddev of <2 values). No exception
// thrown so callers don't need try/catch in render paths.

export function sum(arr: number[]): number {
  let s = 0;
  for (const x of arr) s += x;
  return s;
}

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return sum(arr) / arr.length;
}

export function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

// p in [0, 1]. Linear interpolation between adjacent ranks (the
// "C = 1" / "Type 7" definition that matches Excel/numpy default).
export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  if (arr.length === 1) return arr[0];
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function min(arr: number[]): number {
  if (arr.length === 0) return 0;
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] < m) m = arr[i];
  return m;
}

export function max(arr: number[]): number {
  if (arr.length === 0) return 0;
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

// Sample stddev (N-1 denominator). Returns 0 for n<2 since population
// stddev of a single point is meaningless and rendering NaN is worse.
export function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let ssq = 0;
  for (const x of arr) ssq += (x - m) ** 2;
  return Math.sqrt(ssq / (arr.length - 1));
}

// Coefficient of variation: stddev / mean. Useful for comparing spread
// across groups with very different magnitudes. 0 if mean is 0.
export function cv(arr: number[]): number {
  const m = mean(arr);
  if (m === 0) return 0;
  return stddev(arr) / m;
}

// Concentration: what share of total comes from the top K rows?
// Used to surface "top 20% of campaigns drive 80% of spend" kind of
// observations.
export function topShare(arr: number[], topK: number): number {
  if (arr.length === 0) return 0;
  const total = sum(arr);
  if (total === 0) return 0;
  const sorted = [...arr].sort((a, b) => b - a);
  const taken = sorted.slice(0, Math.min(topK, sorted.length));
  return sum(taken) / total;
}

// Gini coefficient — 0 = perfectly equal spend, 1 = all on one row.
// Useful for spotting "is spend evenly spread or concentrated?"
export function gini(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sum(sorted);
  if (total === 0) return 0;
  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += (i + 1) * sorted[i];
  }
  return (2 * weightedSum) / (n * total) - (n + 1) / n;
}

// Full distribution summary in one shot. Caller renders the columns
// they want.
export interface DistStats {
  count: number;
  sum: number;
  mean: number;
  median: number;
  stddev: number;
  cv: number;
  min: number;
  p25: number;
  p75: number;
  p95: number;
  max: number;
  gini: number;
}

export function summarize(arr: number[]): DistStats {
  return {
    count: arr.length,
    sum: sum(arr),
    mean: mean(arr),
    median: median(arr),
    stddev: stddev(arr),
    cv: cv(arr),
    min: min(arr),
    p25: percentile(arr, 0.25),
    p75: percentile(arr, 0.75),
    p95: percentile(arr, 0.95),
    max: max(arr),
    gini: gini(arr),
  };
}
