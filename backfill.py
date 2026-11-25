#!/usr/bin/env python3
"""
Builds a local git repo with backdated commits so the GitHub contribution graph
is densely filled from START to today.

Usage:
  python3 backfill.py                       # uses `git config user.email/name`
  python3 backfill.py --email you@x.com --name "You" --start 2017-01-01 --out ./activity-repo

Then:
  cd activity-repo
  git remote add origin git@github.com:<you>/<private-repo>.git
  git push -u origin main

Notes:
  * The email MUST be one verified on your GitHub account, or commits won't count.
  * For a private repo to show on your profile, enable
    Profile -> "Contributions" dropdown -> "Private contributions".
"""
import argparse
import datetime as dt
import os
import random
import subprocess
import sys

MESSAGES = [
    "Update notes", "Refactor helper", "Fix typo", "Add tests", "Tidy up",
    "Improve docs", "Minor tweaks", "WIP", "Cleanup", "Small fix",
    "Update config", "Rework logic", "Add example", "Bump version",
    "Handle edge case", "Rename variables", "Update readme", "Fix lint",
]


def default(key):
    try:
        return subprocess.check_output(["git", "config", key], text=True).strip()
    except Exception:
        return ""


def commits_for_day(day, rng):
    """How many commits on this day. Tune the numbers for more/less density."""
    weekend = day.weekday() >= 5
    if rng.random() > (0.55 if weekend else 0.92):  # chance of being active
        return 0
    n = rng.choices([1, 2, 3, 4, 6, 8, 12, 16], weights=[10, 18, 20, 18, 14, 10, 6, 4])[0]
    return max(1, n // 2) if weekend else n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", default=default("user.email"))
    ap.add_argument("--name", default=default("user.name") or "dev")
    ap.add_argument("--start", default="2017-01-01")
    ap.add_argument("--end", default=dt.date.today().isoformat())
    ap.add_argument("--out", default="activity-repo")
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()

    if not a.email:
        sys.exit("Provide --email (must be verified on your GitHub account).")
    if os.path.exists(a.out):
        sys.exit(f"{a.out} already exists; choose another --out or delete it.")

    rng = random.Random(a.seed)
    start = dt.date.fromisoformat(a.start)
    end = dt.date.fromisoformat(a.end)

    os.makedirs(a.out)
    subprocess.check_call(["git", "init", "-q", "-b", "main"], cwd=a.out)

    ident = f"{a.name} <{a.email}>"
    stream = []
    mark = 0

    def emit(ts, msg, first=False):
        nonlocal mark
        mark += 1
        data = msg.encode()
        stream.append(f"commit refs/heads/main\nmark :{mark}\n".encode())
        stream.append(f"author {ident} {ts} +0000\ncommitter {ident} {ts} +0000\n".encode())
        stream.append(f"data {len(data)}\n".encode() + data + b"\n")
        if first:
            readme = b"# activity\n"
            stream.append(b"M 100644 inline README.md\n" + f"data {len(readme)}\n".encode() + readme + b"\n")
        else:
            stream.append(f"from :{mark - 1}\n".encode())
        stream.append(b"\n")

    total = 0
    day = start
    while day <= end:
        n = commits_for_day(day, rng)
        hours = sorted(rng.sample(range(8, 23), min(n, 15))) if n else []
        while len(hours) < n:  # more commits than distinct hours
            hours.append(rng.randrange(8, 23))
        hours.sort()
        for h in hours:
            when = dt.datetime(day.year, day.month, day.day, h, rng.randrange(60), rng.randrange(60),
                               tzinfo=dt.timezone.utc)
            emit(int(when.timestamp()), rng.choice(MESSAGES), first=(total == 0))
            total += 1
        day += dt.timedelta(days=1)

    if total == 0:
        sys.exit("No commits generated.")

    subprocess.run(["git", "fast-import", "--quiet"], cwd=a.out, input=b"".join(stream), check=True)
    subprocess.check_call(["git", "reset", "-q", "--hard", "main"], cwd=a.out)
    print(f"Done: {total} commits from {start} to {end} in ./{a.out}")
    print("Next: cd", a.out, "&& git remote add origin <private-repo-url> && git push -u origin main")


if __name__ == "__main__":
    main()
