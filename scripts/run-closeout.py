#!/usr/bin/env python3
"""momentum-factory run close-out — Life OS D-073 (reminder D-20261116-10).

Fixes the recurring failure class (runs 22/25/26): a factory run dies mid-flight and leaves a
stale kanban/LOCK.json plus a run report stuck at "in progress", while the cron job reports ok.

Safe to call at ANY time:
  - refuses to act while a LIVE run holds kanban/LOCK.json (pid alive)
  - idempotent (safe to run twice)

Modes:
  scripts/run-closeout.py            # repair mode: audit newest report, repair if dirty
  scripts/run-closeout.py --check    # audit only: exit 0 clean / exit 1 dirty (prestate/CI)

Repair actions (only when the newest kanban/RUNS/*.md is dirty):
  1. Fill dirty report sections with "NOT CLOSED — run died" markers.
  2. STATE.json: failure_reason + job_failed=true (schema preserved; notes stays a string).
  3. kanban/OWNER-QUEUE.md: deduped automated close-out entry.
  4. Remove kanban/LOCK.json (gitignored; filesystem-only).
"""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
KANBAN = REPO / "kanban"
STATE = KANBAN / "STATE.json"
QUEUE = KANBAN / "OWNER-QUEUE.md"
MARKER = "(in progress)"


def lock_holds_live_run() -> bool:
    lock = KANBAN / "LOCK.json"
    if not lock.exists():
        return False
    try:
        data = json.loads(lock.read_text())
    except Exception:
        return False  # unparseable lock = stale, not live
    pid = data.get("pid")
    if not pid:
        return False  # pid null/absent = owning run recorded no pid; cannot be alive
    try:
        os.kill(int(pid), 0)
        return True  # process exists -> a live run holds the lock
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # exists but not ours -> treat as live
    except (TypeError, ValueError):
        return False


def newest_report() -> Path | None:
    files = sorted(KANBAN.glob("RUNS/*.md"))
    return files[-1] if files else None


def audit(text: str) -> list[str]:
    dirty = []
    if MARKER in text:
        dirty.append("SECTIONS_IN_PROGRESS")
    if len(text.splitlines()) < 15:
        dirty.append("REPORT_SHORT(<15 lines)")
    return dirty


def fill_report(path: Path, text: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    out = []
    for line in text.splitlines():
        if MARKER in line:
            out.append(f"NOT CLOSED — run died before this section was filled (automated close-out {ts})")
        else:
            out.append(line)
    return "\n".join(out) + "\n"


def main() -> int:
    check_only = "--check" in sys.argv
    report = newest_report()
    if report is None:
        print("CLOSEOUT: no run report found — nothing to audit")
        return 1

    text = report.read_text()
    dirty = audit(text)
    m = re.search(r"# Factory Run #(\d+)", text)
    run_no = int(m.group(1)) if m else 0
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")

    if check_only:
        if dirty:
            print(f"CHECK DIRTY: run {run_no} report {report.name}: {', '.join(dirty)}")
            return 1
        print(f"CHECK CLEAN: run {run_no} report {report.name} closed out properly")
        return 0

    if not dirty:
        print(f"CLOSEOUT CLEAN: run {run_no} ({report.name}) — nothing to repair")
        lock = KANBAN / "LOCK.json"
        if lock.exists() and not lock_holds_live_run():
            lock.unlink()
            print("  removed leftover kanban/LOCK.json (no live run holds it)")
        return 0

    if lock_holds_live_run():
        print("CLOSEOUT REFUSED: a LIVE run holds kanban/LOCK.json — not repairing a live report")
        return 2

    age_min = (datetime.now(timezone.utc).timestamp() - report.stat().st_mtime) / 60
    if age_min < 30:
        print(
            f"CLOSEOUT REFUSED: {report.name} was modified {age_min:.0f} min ago — a live run is"
            " likely mid-flight (pid-null locks cannot prove liveness); not repairing"
        )
        return 2

    print(f"CLOSEOUT REPAIR: run {run_no} ({report.name}) — {', '.join(dirty)}")

    report.write_text(fill_report(report, text))
    print("  report: dirty sections filled with NOT CLOSED markers")

    try:
        state = json.loads(STATE.read_text())
    except Exception as e:
        print(f"  [skip STATE.json: {e}]")
        state = None
    if state is not None:
        state["failure_reason"] = (
            f"run {run_no} died mid-run: report had {', '.join(dirty)} (automated close-out {ts})"
        )
        state["job_failed"] = True
        STATE.write_text(json.dumps(state, indent=2) + "\n")
        print(f"  STATE.json: failure_reason + job_failed=true (last_run={state.get('last_run')})")

    try:
        q = QUEUE.read_text() if QUEUE.exists() else "# Owner queue\n"
        entry = (
            f"- automated close-out {ts}: run {run_no} died mid-run; report {report.name} had "
            f"{', '.join(dirty)}; informational, no owner decision needed"
        )
        if entry not in q:
            q = q.rstrip() + "\n\n" + entry + "\n"
            QUEUE.write_text(q)
            print("  OWNER-QUEUE.md: automated close-out entry added")
        else:
            print("  OWNER-QUEUE.md: entry already present (dedupe)")
    except Exception as e:
        print(f"  [skip OWNER-QUEUE.md: {e}]")

    lock = KANBAN / "LOCK.json"
    if lock.exists():
        lock.unlink()
        print("  removed kanban/LOCK.json")

    print("DONE — commit kanban/STATE.json kanban/OWNER-QUEUE.md + the report to persist")
    return 0


if __name__ == "__main__":
    sys.exit(main())
