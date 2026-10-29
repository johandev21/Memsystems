#!/usr/bin/env python3
"""Private JSON-stdin/WAV-stdout bridge for the backend Kokoro service."""

import argparse
import json
import os
import sys
from io import BytesIO
from pathlib import Path

MAX_TEXT_CHARS = 30_000
MAX_SECTION_CHARS = 4_000
MAX_SECTIONS = 40
MAX_AUDIO_SECONDS = 780
MAX_WAV_BYTES = 40 * 1024 * 1024


def synthesize_samples(model, sections, voice, language, numpy):
    parts = []
    sample_rate = None
    for section in sections:
        samples, section_rate = model.create(
            section["text"], voice=voice, lang=language
        )
        if sample_rate is not None and section_rate != sample_rate:
            raise ValueError("SYNTHESIS_FAILED")
        sample_rate = section_rate
        parts.append(numpy.asarray(samples, dtype=numpy.float32))
    return numpy.concatenate(parts), sample_rate


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--voices", required=True)
    args = parser.parse_args()
    try:
        if not Path(args.model).is_file() or not Path(args.voices).is_file():
            raise ValueError("MISSING_ARTIFACT")
        request = json.load(sys.stdin)
        sections = request.get("sections")
        language = request.get("language")
        if (
            not isinstance(sections, list)
            or not 1 <= len(sections) <= MAX_SECTIONS
            or any(
                not isinstance(section, dict)
                or not isinstance(section.get("text"), str)
                or not section["text"].strip()
                or len(section["text"]) > MAX_SECTION_CHARS
                for section in sections
            )
            or sum(len(section["text"]) for section in sections) > MAX_TEXT_CHARS
        ):
            raise ValueError("INVALID_TEXT")
        settings = {"en": ("af_heart", "en-us"), "es": ("ef_dora", "es")}
        if language not in settings:
            raise ValueError("UNSUPPORTED_LANGUAGE")

        # Keep native math libraries from starting their own worker pools.
        os.environ.setdefault("OMP_NUM_THREADS", "1")
        os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
        from kokoro_onnx import Kokoro
        import soundfile as sf
        import numpy as np

        model = Kokoro(args.model, args.voices)
        voice, lang = settings[language]
        samples, sample_rate = synthesize_samples(
            model, sections, voice, lang, np
        )
        duration = len(samples) / sample_rate
        if duration <= 0 or duration > MAX_AUDIO_SECONDS:
            raise ValueError("INVALID_DURATION")
        output = BytesIO()
        sf.write(output, samples, sample_rate, format="WAV", subtype="PCM_16")
        wav = output.getvalue()
        if len(wav) > MAX_WAV_BYTES:
            raise ValueError("AUDIO_TOO_LARGE")
        sys.stdout.buffer.write(wav)
        return 0
    except Exception as error:
        # Only stable error categories go to stderr; never echo text or filesystem paths.
        message = str(error) if isinstance(error, ValueError) else "SYNTHESIS_FAILED"
        if message not in {
            "MISSING_ARTIFACT", "INVALID_TEXT", "UNSUPPORTED_LANGUAGE",
            "INVALID_DURATION", "AUDIO_TOO_LARGE", "SYNTHESIS_FAILED",
        }:
            message = "SYNTHESIS_FAILED"
        sys.stderr.write(message + "\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
