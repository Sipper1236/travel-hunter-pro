#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v uv >/dev/null || { printf '%s\n' 'Install uv to set up the local model.' >&2; exit 1; }
uv venv --python 3.12 .venv-laya
uv pip install --python .venv-laya/bin/python --torch-backend cpu 'laya==0.4.17'
HF_HUB_DISABLE_XET=1 .venv-laya/bin/python - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download('convaiinnovations/laya',revision='7b928d828b7b0e022f929d9bd2e44165aa270148',local_dir='.cache/laya-model',allow_patterns=['rl_agent_config.json','model.safetensors','tokenizer/*','encoder/*'],max_workers=2)
print('Local Laya model is ready.')
PY
