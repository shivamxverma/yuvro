#!/usr/bin/env python3
import argparse
import os
import sys


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app.services.cas_gc_service import run_cas_gc_once


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Delete orphaned CAS objects from S3 after a grace period."
    )
    parser.add_argument(
        "--grace-hours",
        type=int,
        default=None,
        help="Override the CAS GC grace period in hours.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=None,
        help="Override the S3 delete batch size for this run.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List orphaned objects without deleting them.",
    )
    args = parser.parse_args()

    result = run_cas_gc_once(
        grace_hours=args.grace_hours,
        batch_size=args.batch_size,
        dry_run=args.dry_run,
    )
    print(result)
    return 0 if result.get("status") in {"ok", "skipped"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
