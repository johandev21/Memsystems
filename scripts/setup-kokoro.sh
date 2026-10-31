#!/usr/bin/env bash
set -euo pipefail

install_dir="${KOKORO_INSTALL_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/memsystems/kokoro}"
mkdir -p "$install_dir/models"
if [[ -n "${KOKORO_SETUP_PYTHON:-}" ]] || command -v python3.12 >/dev/null 2>&1; then
  python_bin="${KOKORO_SETUP_PYTHON:-python3.12}"
  "$python_bin" -c 'import sys; assert sys.version_info[:2] == (3, 12), "Python 3.12 is required"'
  "$python_bin" -m venv "$install_dir/venv"
  "$install_dir/venv/bin/python" -m pip install 'kokoro-onnx==0.6.1' 'soundfile==0.13.1'
elif command -v uv >/dev/null 2>&1; then
  uv venv --python 3.12 "$install_dir/venv"
  uv pip install --python "$install_dir/venv/bin/python" 'kokoro-onnx==0.6.1' 'soundfile==0.13.1'
else
  printf 'Python 3.12 or uv is required for Kokoro setup.\n' >&2
  exit 1
fi

base='https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1'
curl --fail --location --output "$install_dir/models/kokoro-v1.0.onnx" "$base/kokoro-v1.0.onnx"
curl --fail --location --output "$install_dir/models/voices-v1.0.bin" "$base/voices-v1.0.bin"
printf '%s  %s\n' \
  beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a "$install_dir/models/kokoro-v1.0.onnx" \
  bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d "$install_dir/models/voices-v1.0.bin" | sha256sum --check --status
printf 'Kokoro installed outside the repository at %s\n' "$install_dir"
printf 'Set these in backend/.env.local:\n'
printf 'KOKORO_PYTHON=%s/venv/bin/python\n' "$install_dir"
printf 'KOKORO_MODEL_PATH=%s/models/kokoro-v1.0.onnx\n' "$install_dir"
printf 'KOKORO_VOICES_PATH=%s/models/voices-v1.0.bin\n' "$install_dir"
