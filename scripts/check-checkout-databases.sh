#!/usr/bin/env bash
set -euo pipefail

target_ref="${1:?Pass the release commit to check}"
deleted_database_paths="$(git diff --name-only --diff-filter=D HEAD "$target_ref" -- '*.db' '*.db-*' '*.sqlite' '*.sqlite-*')"

while IFS= read -r database_path; do
  if [ -e "$database_path" ]; then
    echo "Release would remove SQLite file: $database_path" >&2
    echo "Back up and move database files outside the checkout before deploying; see docs/deployment.md." >&2
    exit 1
  fi
done <<< "$deleted_database_paths"
