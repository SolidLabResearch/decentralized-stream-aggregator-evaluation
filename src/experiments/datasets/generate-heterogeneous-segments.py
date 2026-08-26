#!/usr/bin/env python3
"""Generate deterministic, non-overlapping 4 Hz temporal DAHCC trace segments."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import mean
from typing import Iterable

GENERATOR_VERSION = "heterogeneous-temporal-segments/v1"
DEFAULT_SOURCE = "/users/kbisenug/dahcc-benchmark-dataset/accelerometer-3minute/32Hz.nt"
TIMESTAMP_PREDICATE = "https://saref.etsi.org/core/hasTimestamp"
REQUIRED_PREDICATES = (
    "https://saref.etsi.org/core/hasValue",
    "https://saref.etsi.org/core/relatesToProperty",
    "https://saref.etsi.org/core/measurementMadeBy",
    "http://purl.org/dc/terms/isVersionOf",
    TIMESTAMP_PREDICATE,
)
TIMESTAMP_PATTERN = re.compile(r"<https://saref\.etsi\.org/core/hasTimestamp>\s+\"([^\"]+)\"")
SUBJECT_PATTERN = re.compile(r"^\s*<([^>]+)>")
TRIPLE_SUBJECT_PATTERN = re.compile(r"(?:^|(?<=\.\s))<([^>]+)>\s+<[^>]+>")
SEGMENTS = (("segment-01", 0), ("segment-02", 60), ("segment-03", 120))
TARGET_INTERVAL = timedelta(milliseconds=250)
SEGMENT_DURATION = timedelta(seconds=60)


@dataclass(frozen=True)
class Observation:
    index: int
    subject: str
    timestamp: datetime
    timestamp_text: str
    line: str


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def parse_timestamp(value: str) -> datetime:
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z", value)
    if not match:
        raise ValueError(f"unsupported timestamp format: {value}")
    year, month, day, hour, minute, second, fraction = match.groups()
    microseconds = int(((fraction or "") + "000000")[:6])
    return datetime(int(year), int(month), int(day), int(hour), int(minute), int(second), microseconds, tzinfo=timezone.utc)


def format_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def load_observations(source: Path) -> list[Observation]:
    if not source.is_file():
        raise ValueError(f"source does not exist or is not a file: {source}")
    observations: list[Observation] = []
    subjects: set[str] = set()
    previous: datetime | None = None
    with source.open("r", encoding="utf-8", newline="") as handle:
        for physical_line, raw in enumerate(handle, start=1):
            line = raw.rstrip("\r\n")
            if not line.strip():
                continue
            subject_match = SUBJECT_PATTERN.match(line)
            if not subject_match:
                raise ValueError(f"source line {physical_line} has no observation subject URI")
            subject = subject_match.group(1)
            if subject in subjects:
                raise ValueError(f"source line {physical_line} duplicates observation subject URI {subject}")
            subjects.add(subject)
            triple_subjects = TRIPLE_SUBJECT_PATTERN.findall(line)
            if len(triple_subjects) != 6 or any(value != subject for value in triple_subjects):
                raise ValueError(
                    f"source line {physical_line} must contain exactly one six-triple observation record"
                )
            for predicate in REQUIRED_PREDICATES:
                if predicate not in line:
                    raise ValueError(f"source line {physical_line} lacks required predicate {predicate}")
            timestamps = TIMESTAMP_PATTERN.findall(line)
            if len(timestamps) != 1:
                raise ValueError(f"source line {physical_line} must contain exactly one saref:hasTimestamp")
            timestamp = parse_timestamp(timestamps[0])
            if previous is not None and timestamp <= previous:
                raise ValueError(f"source timestamps are not strictly increasing at line {physical_line}")
            previous = timestamp
            observations.append(Observation(len(observations), subject, timestamp, timestamps[0], line))
    if not observations:
        raise ValueError("source contains no observations")
    if observations[-1].timestamp < observations[0].timestamp + timedelta(seconds=180):
        raise ValueError("source does not cover at least 180 seconds from its first timestamp")
    return observations


def select_nearest(candidates: Iterable[Observation], target: datetime, selected_indices: set[int]) -> Observation:
    available = [item for item in candidates if item.index not in selected_indices]
    if not available:
        raise ValueError(f"cannot select a unique source observation for target {format_timestamp(target)}")
    # datetime comparison makes ties deterministic: earlier timestamp then lower source index wins.
    return min(available, key=lambda item: (abs(item.timestamp - target), item.timestamp, item.index))


def segment_selection(observations: list[Observation], segment_name: str, offset_seconds: int) -> tuple[dict, list[Observation]]:
    source_start = observations[0].timestamp
    segment_start = source_start + timedelta(seconds=offset_seconds)
    segment_end = segment_start + SEGMENT_DURATION
    candidates = [item for item in observations if segment_start <= item.timestamp < segment_end]
    if not candidates:
        raise ValueError(f"{segment_name} has no source observations in its 60-second interval")
    selected_indices: set[int] = set()
    selected: list[Observation] = []
    targets: list[datetime] = []
    errors_us: list[int] = []
    for k in range(240):
        target = segment_start + k * TARGET_INTERVAL
        item = select_nearest(candidates, target, selected_indices)
        selected_indices.add(item.index)
        selected.append(item)
        targets.append(target)
        error = abs(item.timestamp - target)
        errors_us.append(error.days * 86_400_000_000 + error.seconds * 1_000_000 + error.microseconds)
    if len(selected) != 240 or len(selected_indices) != 240:
        raise ValueError(f"{segment_name} could not select exactly 240 unique source observations")
    provenance = {
        "generator_version": GENERATOR_VERSION,
        "segment_identifier": segment_name,
        "segment_index": offset_seconds // 60 + 1,
        "segment_start_timestamp": format_timestamp(segment_start),
        "segment_end_exclusive_timestamp": format_timestamp(segment_end),
        "target_frequency_hz": 4,
        "target_interval_ms": 250,
        "target_count": 240,
        "selection_method": "nearest-source-timestamp",
        "tie_break": "earlier-source-timestamp",
        "interpolation": False,
        "synthetic_values": False,
        "output_observation_count": len(selected),
        "selected_source_observation_indices": [item.index for item in selected],
        "selected_source_timestamps": [item.timestamp_text for item in selected],
        "target_timestamps": [format_timestamp(target) for target in targets],
        "absolute_timestamp_error_us": errors_us,
        "absolute_timestamp_error_ms": [error / 1000 for error in errors_us],
        "maximum_target_error_ms": max(errors_us) / 1000,
        "mean_target_error_ms": mean(errors_us) / 1000,
        "selected_observations_unique": True,
    }
    return provenance, selected


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def generate(source: Path, output_root: Path, expected_sha256: str | None, strict: bool) -> dict:
    if strict and not expected_sha256:
        raise ValueError("--strict-source-sha256 requires --expected-source-sha256")
    source_sha256 = sha256_file(source)
    if expected_sha256 and source_sha256.lower() != expected_sha256.lower():
        raise ValueError(f"source SHA256 mismatch: expected {expected_sha256}, found {source_sha256}")
    observations = load_observations(source)
    if output_root.exists() and any(output_root.iterdir()):
        raise ValueError(f"refusing to overwrite non-empty output root: {output_root}")
    output_root.mkdir(parents=True, exist_ok=True)
    source_metadata = {"source_file_path": str(source), "source_sha256": source_sha256, "source_observation_count": len(observations), "source_first_timestamp": observations[0].timestamp_text, "source_last_timestamp": observations[-1].timestamp_text}
    entries: list[dict] = []
    selected_across_segments: set[int] = set()
    for segment_name, offset_seconds in SEGMENTS:
        provenance, selected = segment_selection(observations, segment_name, offset_seconds)
        overlap = selected_across_segments.intersection(item.index for item in selected)
        if overlap:
            raise ValueError(f"selected source observations overlap across segments: {sorted(overlap)}")
        selected_across_segments.update(item.index for item in selected)
        directory = output_root / segment_name
        directory.mkdir()
        output = directory / "4Hz.nt"
        output.write_text("".join(item.line + "\n" for item in selected), encoding="utf-8", newline="")
        provenance.update(source_metadata)
        provenance["output_sha256"] = sha256_file(output)
        provenance_path = directory / "provenance.json"
        write_json(provenance_path, provenance)
        entries.append({"segment_identifier": segment_name, "segment_index": provenance["segment_index"], "interval": [provenance["segment_start_timestamp"], provenance["segment_end_exclusive_timestamp"]], "output_observation_count": 240, "output_sha256": provenance["output_sha256"], "provenance_sha256": sha256_file(provenance_path)})
    manifest = {"generator_version": GENERATOR_VERSION, **source_metadata, "segments": entries, "segments_non_overlapping": True, "selected_source_indices_mutually_disjoint": len(selected_across_segments) == 720, "total_output_observation_count": 720}
    write_json(output_root / "manifest.json", manifest)
    return manifest


def verify(source: Path, output_root: Path, expected_sha256: str | None, strict: bool) -> dict:
    if strict and not expected_sha256:
        raise ValueError("--strict-source-sha256 requires --expected-source-sha256")
    source_sha256 = sha256_file(source)
    if expected_sha256 and source_sha256.lower() != expected_sha256.lower():
        raise ValueError(f"source SHA256 mismatch: expected {expected_sha256}, found {source_sha256}")
    observations = load_observations(source)
    source_lines = {item.index: item.line for item in observations}
    manifest_path = output_root / "manifest.json"
    if not manifest_path.is_file():
        raise ValueError(f"missing manifest: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    all_indices: set[int] = set()
    summary: list[dict] = []
    for segment_name, _ in SEGMENTS:
        directory = output_root / segment_name
        provenance = json.loads((directory / "provenance.json").read_text(encoding="utf-8"))
        lines = (directory / "4Hz.nt").read_text(encoding="utf-8").splitlines()
        indices = provenance["selected_source_observation_indices"]
        if len(lines) != 240 or len(indices) != 240 or len(set(indices)) != 240:
            raise ValueError(f"{segment_name} does not contain exactly 240 unique observations")
        if any(source_lines[index] != line for index, line in zip(indices, lines)):
            raise ValueError(f"{segment_name} output RDF lines do not exactly match selected source lines")
        if all_indices.intersection(indices):
            raise ValueError(f"{segment_name} overlaps selected source indices with another segment")
        all_indices.update(indices)
        if sha256_file(directory / "4Hz.nt") != provenance["output_sha256"]:
            raise ValueError(f"{segment_name} output SHA256 does not match provenance")
        summary.append({"segment": segment_name, "observation_count": len(lines), "output_sha256": provenance["output_sha256"], "timestamp_range": [provenance["selected_source_timestamps"][0], provenance["selected_source_timestamps"][-1]], "maximum_target_error_ms": provenance["maximum_target_error_ms"], "mean_target_error_ms": provenance["mean_target_error_ms"]})
    if len(all_indices) != 720 or not manifest.get("segments_non_overlapping") or not manifest.get("selected_source_indices_mutually_disjoint"):
        raise ValueError("manifest does not prove 720 mutually disjoint selected observations")
    return {"source_sha256": source_sha256, "segments": summary, "selected_indices_mutually_disjoint": True, "manifest_sha256": sha256_file(manifest_path)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(DEFAULT_SOURCE))
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--expected-source-sha256")
    parser.add_argument("--strict-source-sha256", action="store_true")
    parser.add_argument("--verify", action="store_true", help="verify an existing generated output tree instead of creating one")
    args = parser.parse_args()
    try:
        result = verify(args.source, args.output_root, args.expected_source_sha256, args.strict_source_sha256) if args.verify else generate(args.source, args.output_root, args.expected_source_sha256, args.strict_source_sha256)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"heterogeneous segment generator: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
