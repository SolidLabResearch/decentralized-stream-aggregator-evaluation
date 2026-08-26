import hashlib
import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATOR_PATH = ROOT / "src/experiments/datasets/generate-heterogeneous-segments.py"
SPEC = importlib.util.spec_from_file_location("heterogeneous_segments", GENERATOR_PATH)
GENERATOR = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = GENERATOR
SPEC.loader.exec_module(GENERATOR)


def timestamp(value: datetime) -> str:
    return value.strftime("%Y-%m-%dT%H:%M:%S.") + f"{value.microsecond // 100:04d}Z"


def observation(index: int, value: datetime) -> str:
    subject = f"https://example.test/participant1/obs{index}"
    return " ".join([
        f"<{subject}> <http://rdfs.org/ns/void#inDataset> <https://dahcc.idlab.ugent.be/Protego/_participant1> .",
        f"<{subject}> <https://saref.etsi.org/core/measurementMadeBy> <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/E4.A03846.Accelerometer> .",
        f"<{subject}> <http://purl.org/dc/terms/isVersionOf> <https://saref.etsi.org/core/Measurement> .",
        f"<{subject}> <https://saref.etsi.org/core/relatesToProperty> <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x> .",
        f"<{subject}> <https://saref.etsi.org/core/hasTimestamp> \"{timestamp(value)}\"^^<http://www.w3.org/2001/XMLSchema#dateTime> .",
        f"<{subject}> <https://saref.etsi.org/core/hasValue> \"{index}.0\"^^<http://www.w3.org/2001/XMLSchema#float> .",
    ])


class HeterogeneousSegmentGeneratorTest(unittest.TestCase):
    def setUp(self):
        self.directory = Path(tempfile.mkdtemp(prefix="heterogeneous-segments-"))
        self.source = self.directory / "source.nt"
        start = datetime(2024, 10, 14, 8, 48, 24, 620000, tzinfo=timezone.utc)
        self.lines = [observation(index, start + timedelta(milliseconds=250 * index)) for index in range(721)]
        self.source.write_text("\n".join(self.lines) + "\n", encoding="utf-8")
        self.source_sha = hashlib.sha256(self.source.read_bytes()).hexdigest()

    def tearDown(self):
        shutil.rmtree(self.directory)

    def test_generation_is_disjoint_exact_and_deterministic(self):
        output_one, output_two = self.directory / "one", self.directory / "two"
        manifest_one = GENERATOR.generate(self.source, output_one, self.source_sha, True)
        manifest_two = GENERATOR.generate(self.source, output_two, self.source_sha, True)
        self.assertEqual(manifest_one, manifest_two)
        self.assertEqual(manifest_one["total_output_observation_count"], 720)
        selected = set()
        for segment_number in range(1, 4):
            name = f"segment-{segment_number:02d}"
            provenance_one = json.loads((output_one / name / "provenance.json").read_text())
            provenance_two = json.loads((output_two / name / "provenance.json").read_text())
            lines = (output_one / name / "4Hz.nt").read_text().splitlines()
            self.assertEqual(len(lines), 240)
            self.assertEqual(len(provenance_one["selected_source_observation_indices"]), 240)
            self.assertEqual(len(set(provenance_one["selected_source_observation_indices"])), 240)
            self.assertFalse(selected.intersection(provenance_one["selected_source_observation_indices"]))
            selected.update(provenance_one["selected_source_observation_indices"])
            self.assertEqual(lines, [self.lines[index] for index in provenance_one["selected_source_observation_indices"]])
            self.assertEqual(provenance_one["output_sha256"], provenance_two["output_sha256"])
            self.assertEqual((output_one / name / "4Hz.nt").read_bytes(), (output_two / name / "4Hz.nt").read_bytes())
            targets = [GENERATOR.parse_timestamp(value) for value in provenance_one["target_timestamps"]]
            self.assertTrue(all(targets[index + 1] - targets[index] == timedelta(milliseconds=250) for index in range(239)))
            self.assertEqual(provenance_one["maximum_target_error_ms"], 0)
        self.assertEqual(len(selected), 720)
        self.assertTrue(GENERATOR.verify(self.source, output_one, self.source_sha, True)["selected_indices_mutually_disjoint"])

    def test_earlier_timestamp_wins_nearest_tie(self):
        base = datetime(2024, 1, 1, tzinfo=timezone.utc)
        earlier = GENERATOR.Observation(0, "earlier", base, timestamp(base), "earlier")
        later_time = base + timedelta(milliseconds=500)
        later = GENERATOR.Observation(1, "later", later_time, timestamp(later_time), "later")
        self.assertEqual(GENERATOR.select_nearest([later, earlier], base + timedelta(milliseconds=250), set()).subject, "earlier")

    def test_strict_hash_mismatch_fails(self):
        with self.assertRaises(ValueError):
            GENERATOR.generate(self.source, self.directory / "bad", "0" * 64, True)


if __name__ == "__main__":
    unittest.main()
