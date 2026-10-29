import unittest

from kokoro_synthesize import synthesize_samples


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
    def test_concatenates_sections_in_order_with_one_voice_and_rate(self):
        model = FakeModel([([1, 2], 24000), ([3, 4], 24000)])
        sections = [{"text": "first"}, {"text": "second"}]

        samples, sample_rate = synthesize_samples(
            model, sections, "af_heart", "en-us", FakeNumpy
        )

        self.assertEqual(samples, [1, 2, 3, 4])
        self.assertEqual(sample_rate, 24000)
        self.assertEqual(
            model.calls,
            [("first", "af_heart", "en-us"), ("second", "af_heart", "en-us")],
        )

    def test_rejects_a_sample_rate_change_between_sections(self):
        model = FakeModel([([1], 24000), ([2], 22050)])

        with self.assertRaisesRegex(ValueError, "SYNTHESIS_FAILED"):
            synthesize_samples(
                model,
                [{"text": "first"}, {"text": "second"}],
                "af_heart",
                "en-us",
                FakeNumpy,
            )


if __name__ == "__main__":
    unittest.main()
