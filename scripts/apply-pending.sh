#!/usr/bin/env bash
# THE NEXT STORE VERSION IS MAIN WITH EVERY PATCH WAITING IN docs/pending IN
# IT, in the README's order, the way the build day applies them. Run from the
# repository root, on a checkout that is thrown away afterwards (a CI job's):
# nothing here is ever committed.
#
# Two jobs in .github/workflows/mobile.yml call it, and they have to agree
# byte for byte, because an update reaches only a build whose fingerprint it
# matches:
#   - the build, when "Build the next store version" is ticked, so the build
#     carries the native work main does not have yet (main is left as it is,
#     so the copies in the stores keep taking updates);
#   - the update, a second time after main's own, while
#     docs/pending/next-store.json says such a build is out to testers, so
#     those testers take every update too.
#
# A patch already in the tree is said and passed over, never applied twice; one
# that neither applies nor is already there stops the job, so nothing is built
# or published from a half-applied tree. The patch files themselves are listed
# by the README's table, so the order is the README's and one source.
set -euo pipefail

waiting="$(grep -oE '^\| `[^`]+\.patch`' docs/pending/README.md | tr -d '|` ' || true)"

# Every patch file is in the table, so none is left out by a missing row:
# asked first, so an empty table with a patch file beside it is no "nothing
# waits".
for f in docs/pending/*.patch; do
  [ -e "$f" ] || continue
  name="$(basename "$f")"
  if ! printf '%s\n' "$waiting" | grep -qxF "$name"; then
    echo "::error::docs/pending/$name is not in docs/pending/README.md's table, so its place in the order is not known."
    exit 1
  fi
done

if [ -z "$waiting" ]; then
  echo "::notice::Nothing waits in docs/pending, so this is main as it is."
  exit 0
fi

# Every row has its file, asked before anything is applied.
for P in $waiting; do
  if [ ! -e "docs/pending/$P" ]; then
    echo "::error::docs/pending/README.md lists $P, and there is no such file."
    exit 1
  fi
done

for P in $waiting; do
  if git apply --check "docs/pending/$P" 2>/dev/null; then
    echo "::notice::Applying docs/pending/$P, which waits for the next store version"
    git apply "docs/pending/$P"
  elif git apply --reverse --check "docs/pending/$P" 2>/dev/null; then
    echo "::notice::docs/pending/$P is already in the tree"
  else
    echo "::error::docs/pending/$P neither applies nor is already in the tree."
    git apply --check "docs/pending/$P"
    exit 1
  fi
done
git status --short
