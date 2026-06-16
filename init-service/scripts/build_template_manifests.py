#!/usr/bin/env python3
import argparse
import json
import os
import sys
from datetime import UTC, datetime


INIT_SERVICE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO_ROOT = os.path.abspath(os.path.join(INIT_SERVICE_DIR, ".."))
if INIT_SERVICE_DIR not in sys.path:
    sys.path.insert(0, INIT_SERVICE_DIR)

from app.services.cas_service import hash_file, upload_file_if_missing


IGNORE_NAMES = {".git", ".venv", "venv", "__pycache__", "node_modules", ".pytest_cache"}
TEMPLATES_DIR = os.path.join(REPO_ROOT, "runner", "templates")
MANIFESTS_DIR = os.path.join(REPO_ROOT, "runner", "template_manifests")


def _iter_templates(selected_template: str | None):
    if selected_template:
        yield selected_template
        return

    for name in sorted(os.listdir(TEMPLATES_DIR)):
        path = os.path.join(TEMPLATES_DIR, name)
        if os.path.isdir(path) and name not in IGNORE_NAMES:
            yield name


def _build_manifest(template_name: str, skip_upload: bool) -> tuple[dict, int]:
    template_dir = os.path.join(TEMPLATES_DIR, template_name)
    if not os.path.isdir(template_dir):
        raise FileNotFoundError(f"Template '{template_name}' not found at {template_dir}")

    directories: list[dict[str, str]] = []
    files: list[dict[str, str | int]] = []
    uploaded_files = 0

    for current_root, dir_names, file_names in os.walk(template_dir):
        dir_names[:] = sorted(name for name in dir_names if name not in IGNORE_NAMES)
        rel_dir = os.path.relpath(current_root, template_dir)
        rel_dir = "" if rel_dir == "." else rel_dir.replace(os.sep, "/")

        if rel_dir:
            directories.append({"path": rel_dir})

        for file_name in sorted(file_names):
            if file_name in IGNORE_NAMES:
                continue
            abs_file = os.path.join(current_root, file_name)
            rel_file = os.path.relpath(abs_file, template_dir).replace(os.sep, "/")
            content_hash, size_bytes = hash_file(abs_file)
            if not skip_upload:
                upload_file_if_missing(content_hash, abs_file)
                uploaded_files += 1
            files.append(
                {
                    "path": rel_file,
                    "contentHash": content_hash,
                    "sizeBytes": size_bytes,
                }
            )

    manifest = {
        "version": 1,
        "templateType": template_name,
        "generatedAt": datetime.now(UTC).isoformat(),
        "directories": directories,
        "files": files,
    }
    return manifest, uploaded_files


def _write_manifest(template_name: str, manifest: dict) -> str:
    os.makedirs(MANIFESTS_DIR, exist_ok=True)
    manifest_path = os.path.join(MANIFESTS_DIR, f"{template_name}.json")
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2, sort_keys=True)
        handle.write("\n")
    return manifest_path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build template manifests with precomputed content hashes for CAS-backed bootstrap."
    )
    parser.add_argument(
        "--template",
        help="Build a manifest for one template, for example fastapi. Defaults to all templates.",
    )
    parser.add_argument(
        "--skip-upload",
        action="store_true",
        help="Only write manifests locally and do not upload content into CAS.",
    )
    args = parser.parse_args()

    built = 0
    uploaded = 0

    try:
        for template_name in _iter_templates(args.template):
            manifest, uploaded_files = _build_manifest(template_name, skip_upload=args.skip_upload)
            manifest_path = _write_manifest(template_name, manifest)
            built += 1
            uploaded += uploaded_files
            print(
                f"BUILT template={template_name} files={len(manifest['files'])} "
                f"directories={len(manifest['directories'])} uploaded={uploaded_files} manifest={manifest_path}"
            )
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    mode = "manifest-only" if args.skip_upload else "manifest+cas"
    print(f"Done. built={built} uploaded={uploaded} mode={mode}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
