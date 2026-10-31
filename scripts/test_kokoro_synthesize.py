import struct
import unittest

from kokoro_synthesize import (
    MAX_SECTION_CHARS,
    MAX_TURNS,
    append_section_cues,
    synthesize_samples,
    validate_request,
)


class FakeNumpy:
    float32 = "float32"

    @staticmethod
    def asarray(samples, dtype):
        return samples

    @staticmethod
    def concatenate(parts):
        return [sample for part in parts for sample in part]


class FakeModel:
    def __init__(self, parts):
        self.parts = iter(parts)
        self.calls = []

    def create(self, text, voice, lang):
        self.calls.append((text, voice, lang))
        return next(self.parts)


class SynthesizeSamplesTests(unittest.TestCase):
    def test_routes_english_and_spanish_dialogue_turns_to_distinct_voices(self):
        for language, lang, host_voice, guest_voice in (
            ("en", "en-us", "af_heart", "am_michael"),
            ("es", "es", "ef_dora", "em_alex"),
        ):
            model = FakeModel([([1], 24000), ([2], 24000)])
            sections = [{
                "text": "host and guest",
                "turns": [
                    {"speaker": "host", "text": "host"},
                    {"speaker": "guest", "text": "guest"},
                ],
            }]

            samples, sample_rate = synthesize_samples(
                model, sections, {"host": host_voice, "guest": guest_voice},
                lang, FakeNumpy,
            )

            self.assertEqual((samples, sample_rate), ([1, 2], 24000))
            self.assertEqual(
                model.calls,
                [("host", host_voice, lang), ("guest", guest_voice, lang)],
            )

    def test_plain_sections_stay_single_narrator_in_mixed_script(self):
        model = FakeModel([([1], 24000), ([2], 24000), ([3], 24000)])
        sections = [
            {"text": "legacy"},
            {"text": "derived", "turns": [
                {"speaker": "host", "text": "one"},
                {"speaker": "guest", "text": "two"},
            ]},
        ]

        samples, _ = synthesize_samples(
            model, sections, {"host": "af_heart", "guest": "am_michael"},
            "en-us", FakeNumpy,
        )

        self.assertEqual(samples, [1, 2, 3])
        self.assertEqual(model.calls, [
            ("legacy", "af_heart", "en-us"),
            ("one", "af_heart", "en-us"),
            ("two", "am_michael", "en-us"),
        ])

    def test_one_wav_cue_per_section_after_multi_turn_section(self):
        offsets = []
        samples, _ = synthesize_samples(
            FakeModel([([1, 2], 24000), ([3], 24000), ([4, 5], 24000)]),
            [
                {"text": "derived", "turns": [
                    {"speaker": "host", "text": "one"},
                    {"speaker": "guest", "text": "two"},
                ]},
                {"text": "legacy"},
            ],
            {"host": "af_heart", "guest": "am_michael"}, "en-us",
            FakeNumpy, offsets,
        )
        self.assertEqual(samples, [1, 2, 3, 4, 5])
        self.assertEqual(offsets, [0, 3])

        original = b"RIFF" + struct.pack("<I", 36) + b"WAVE" + bytes(32)
        wav = append_section_cues(original, offsets)
        self.assertEqual(struct.unpack_from("<I", wav, 4)[0], len(wav) - 8)
        self.assertEqual(wav[44:48], b"cue ")
        self.assertEqual(struct.unpack_from("<I", wav, 52)[0], 2)
        self.assertEqual(struct.unpack_from("<I", wav, 56)[0], 0)
        self.assertEqual(struct.unpack_from("<I", wav, 80)[0], 1)
        self.assertEqual(struct.unpack_from("<I", wav, 100)[0], 3)

    def test_rejects_a_sample_rate_change_between_turns(self):
        with self.assertRaisesRegex(ValueError, "SYNTHESIS_FAILED"):
            synthesize_samples(
                FakeModel([([1], 24000), ([2], 22050)]),
                [{"text": "derived", "turns": [
                    {"speaker": "host", "text": "one"},
                    {"speaker": "guest", "text": "two"},
                ]}],
                {"host": "af_heart", "guest": "am_michael"},
                "en-us", FakeNumpy,
            )


class RequestValidationTests(unittest.TestCase):
    def validate(self, sections, language="en"):
        return validate_request({"sections": sections, "language": language})

    def test_rejects_invalid_speakers_and_empty_turn_lists(self):
        for turns in (
            [{"speaker": "narrator", "text": "hello"}],
            [{"speaker": "host", "text": "  "}],
            [],
        ):
            with self.subTest(turns=turns), self.assertRaisesRegex(ValueError, "INVALID_TEXT"):
                self.validate([{"text": "hello", "turns": turns}])

    def test_limits_count_turn_text_without_counting_derived_section_text(self):
        self.validate([{
            "text": "a" * MAX_SECTION_CHARS,
            "turns": [{"speaker": "host", "text": "a" * MAX_SECTION_CHARS}],
        }])
        with self.assertRaisesRegex(ValueError, "INVALID_TEXT"):
            self.validate([{
                "text": "derived",
                "turns": [
                    {"speaker": "host", "text": "a" * (MAX_SECTION_CHARS // 2 + 1)},
                    {"speaker": "guest", "text": "b" * (MAX_SECTION_CHARS // 2)},
                ],
            }])
        with self.assertRaisesRegex(ValueError, "INVALID_TEXT"):
            self.validate([{"text": "a" * MAX_SECTION_CHARS} for _ in range(8)])

    def test_rejects_turn_count_overview_limit(self):
        sections = [
            {"text": "derived", "turns": [{"speaker": "host", "text": "x"}] * (MAX_TURNS // 2 + 1)},
            {"text": "derived", "turns": [{"speaker": "guest", "text": "x"}] * (MAX_TURNS // 2)},
        ]
        with self.assertRaisesRegex(ValueError, "INVALID_TEXT"):
            self.validate(sections)


if __name__ == "__main__":
    unittest.main()
