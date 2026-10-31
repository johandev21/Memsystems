#!/usr/bin/env python3
"""Private JSON-stdin/WAV-stdout bridge for the backend Kokoro service."""

import argparse
import json
import os
import struct
import sys
from io import BytesIO
from pathlib import Path

MAX_TEXT_CHARS = 30_000
MAX_SECTION_CHARS = 4_000
MAX_SECTIONS = 40
MAX_TURNS = 120
MAX_AUDIO_SECONDS = 780
MAX_WAV_BYTES = 40 * 1024 * 1024


def validate_request(request):
    sections = request.get("sections") if isinstance(request, dict) else None
    language = request.get("language") if isinstance(request, dict) else None
    if not isinstance(sections, list) or not 1 <= len(sections) <= MAX_SECTIONS:
        raise ValueError("INVALID_TEXT")

    total_chars = 0
    total_turns = 0
    for section in sections:
        if not isinstance(section, dict) or not isinstance(section.get("text"), str):
            raise ValueError("INVALID_TEXT")
        if "turns" in section:
            turns = section["turns"]
            if not isinstance(turns, list) or not turns or len(turns) > MAX_TURNS:
                raise ValueError("INVALID_TEXT")
            section_chars = 2 * (len(turns) - 1)
            for turn in turns:
                if (
                    not isinstance(turn, dict)
                    or turn.get("speaker") not in {"host", "guest"}
                    or not isinstance(turn.get("text"), str)
                    or not turn["text"].strip()
                ):
                    raise ValueError("INVALID_TEXT")
                section_chars += len(turn["text"])
                total_turns += 1
                if total_turns > MAX_TURNS or section_chars > MAX_SECTION_CHARS:
                    raise ValueError("INVALID_TEXT")
        else:
            text = section["text"]
            if not text.strip():
                raise ValueError("INVALID_TEXT")
            section_chars = len(text)
            total_turns += 1
            if section_chars > MAX_SECTION_CHARS or total_turns > MAX_TURNS:
                raise ValueError("INVALID_TEXT")
        total_chars += section_chars
        if total_chars > MAX_TEXT_CHARS:
            raise ValueError("INVALID_TEXT")
    if language not in {"en", "es"}:
        raise ValueError("UNSUPPORTED_LANGUAGE")
    return sections, language


def synthesize_samples(model, sections, voice, language, numpy, section_offsets=None):
    """Synthesize sections; voice may be a legacy narrator name or host/guest map."""
    parts = []
    sample_rate = None
    frame_offset = 0
    for section in sections:
        turns = section.get("turns")
        utterances = turns if turns is not None else [
            {"speaker": "host", "text": section["text"]}
        ]
        section_parts = []
        section_start = frame_offset
        for turn in utterances:
            speaker_voice = voice.get(turn["speaker"], voice.get("host")) if isinstance(voice, dict) else voice
            samples, section_rate = model.create(
                turn["text"], voice=speaker_voice, lang=language
            )
            if section_rate != 24_000 or (
                sample_rate is not None and section_rate != sample_rate
            ):
                raise ValueError("SYNTHESIS_FAILED")
            sample_rate = section_rate
            if len(samples) == 0:
                raise ValueError("INVALID_DURATION")
            frame_offset += len(samples)
            if frame_offset > MAX_AUDIO_SECONDS * sample_rate:
                raise ValueError("INVALID_DURATION")
            section_parts.append(numpy.asarray(samples, dtype=numpy.float32))
        if section_offsets is not None:
            section_offsets.append(section_start)
        parts.append(numpy.concatenate(section_parts))
    return numpy.concatenate(parts), sample_rate


def append_section_cues(wav, offsets):
    """Standard RIFF cue markers preserve exact section starts through export/duplication."""
    payload = struct.pack("<I", len(offsets))
    for index, offset in enumerate(offsets):
        payload += struct.pack("<II4sIII", index, offset, b"data", 0, 0, offset)
    chunk = b"cue " + struct.pack("<I", len(payload)) + payload
    result = wav + chunk
    return result[:4] + struct.pack("<I", len(result) - 8) + result[8:]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--voices", required=True)
    args = parser.parse_args()
    try:
        if not Path(args.model).is_file() or not Path(args.voices).is_file():
            raise ValueError("MISSING_ARTIFACT")
        sections, language = validate_request(json.load(sys.stdin))

        # Keep native math libraries from starting their own worker pools.
        os.environ.setdefault("OMP_NUM_THREADS", "1")
        os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
        from kokoro_onnx import Kokoro
        import soundfile as sf
        import numpy as np

        model = Kokoro(args.model, args.voices)
        voices = {
            "en": ({"host": "af_heart", "guest": "am_michael"}, "en-us"),
            "es": ({"host": "ef_dora", "guest": "em_alex"}, "es"),
        }
        speaker_voices, lang = voices[language]
        section_offsets = []
        samples, sample_rate = synthesize_samples(
            model, sections, speaker_voices, lang, np, section_offsets
        )
        duration = len(samples) / sample_rate
        if duration <= 0 or duration > MAX_AUDIO_SECONDS:
            raise ValueError("INVALID_DURATION")
        output = BytesIO()
        sf.write(output, samples, sample_rate, format="WAV", subtype="PCM_16")
        wav = append_section_cues(output.getvalue(), section_offsets)
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
