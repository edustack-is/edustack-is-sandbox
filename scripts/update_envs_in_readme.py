#!/usr/bin/env python3
"""Maintain the auto-managed Live sandboxes table in README.md.

Reads ENV_NAME, DOMAIN, ACTION from the environment and rewrites the block
delimited by the DEPLOYED_ENVS_START / DEPLOYED_ENVS_END markers.
"""
from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timezone

README = "README.md"
START = "<!-- DEPLOYED_ENVS_START -->"
END = "<!-- DEPLOYED_ENVS_END -->"


def main() -> int:
    env_name = os.environ["ENV_NAME"]
    domain = os.environ["DOMAIN"]
    action = os.environ["ACTION"]

    with open(README, "r", encoding="utf-8") as f:
        content = f.read()

    match = re.search(
        re.escape(START) + r"(.*?)" + re.escape(END),
        content,
        flags=re.DOTALL,
    )
    if not match:
        print(
            f"ERROR: could not find {START}/{END} markers in {README}",
            file=sys.stderr,
        )
        return 1

    rows: dict[str, list[str]] = {}
    for line in match.group(1).splitlines():
        stripped = line.strip()
        if not stripped.startswith("| sandbox-"):
            continue
        cols = [c.strip() for c in stripped.strip("|").split("|")]
        # Accept legacy 4-col rows (Env, Frontend, Backend, Last deployed) and
        # upgrade them in place to 5-col (insert "—" for MailDev).
        if len(cols) == 4:
            cols = [cols[0], cols[1], cols[2], "—", cols[3]]
        if len(cols) >= 5:
            rows[cols[0]] = cols[:5]

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    if action == "deploy":
        rows[env_name] = [
            env_name,
            f"https://{env_name}.{domain}",
            f"https://be-{env_name}.{domain}",
            f"https://mail-{env_name}.{domain}",
            now,
        ]
    elif action == "delete":
        rows.pop(env_name, None)
    else:
        print(f"ERROR: unknown ACTION={action!r}", file=sys.stderr)
        return 1

    def sort_key(name: str) -> int:
        try:
            return int(name.removeprefix("sandbox-"))
        except ValueError:
            return 10**9

    sorted_rows = sorted(rows.values(), key=lambda r: sort_key(r[0]))

    if sorted_rows:
        lines = [
            "",
            "",
            "| Env | Frontend | Backend | MailDev | Last deployed |",
            "| --- | --- | --- | --- | --- |",
        ]
        for r in sorted_rows:
            lines.append(f"| {r[0]} | {r[1]} | {r[2]} | {r[3]} | {r[4]} |")
        lines.append("")
        body = "\n".join(lines)
    else:
        body = "\n\n_No environments deployed._\n\n"

    new_section = f"{START}{body}{END}"
    new_content = content[: match.start()] + new_section + content[match.end() :]

    with open(README, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"Updated README live-sandbox table after {action} of {env_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
