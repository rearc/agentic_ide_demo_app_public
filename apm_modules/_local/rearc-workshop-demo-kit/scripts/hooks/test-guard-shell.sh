#!/usr/bin/env bash
# =============================================================================
# test-guard-shell.sh - checks guard-shell.sh against commands it must block
# or allow. Run it after changing the guard, and once on each platform
# (macOS /bin/bash 3.2, Git Bash on Windows):
#
#   bash .claude/hooks/rearc-workshop-demo-kit/scripts/hooks/test-guard-shell.sh
#
# Each case line is: BLOCK or ALLOW, a tab, then the command. "\n" in a command
# is a newline (for heredocs). Prints each failure and a pass/fail count; exits
# 1 if any case fails.
# =============================================================================

set -uo pipefail
command -v jq >/dev/null 2>&1 || { echo "jq is required"; exit 1; }

GUARD="$(cd "$(dirname "$0")" && pwd)/guard-shell.sh"
pass=0; fail=0

while IFS=$'\t' read -r want cmd; do
  [ -z "$want" ] && continue
  cmd=$(printf '%b' "$cmd")
  out=$(jq -n --arg c "$cmd" '{tool_name: "Bash", tool_input: {command: $c}}' | bash "$GUARD")
  if printf '%s' "$out" | grep -q '"deny"'; then got=BLOCK; else got=ALLOW; fi
  if [ "$got" = "$want" ]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1)); echo "FAIL: expected $want, got $got: $cmd"
  fi
done <<'CASES'
BLOCK	rm -rf build
BLOCK	rm -r -f build
BLOCK	rm -fr build
BLOCK	rm -Rf build
BLOCK	rm --recursive --force build
BLOCK	sudo rm -rf /
BLOCK	sudo -u root rm -r -f /var/x
BLOCK	/bin/rm -rf x
BLOCK	cd backend && rm -rf venv
BLOCK	bash -c "rm -rf /"
BLOCK	sh -c 'cd /tmp; rm -rf x'
BLOCK	find . -name '*.pyc' -exec rm -rf {} +
BLOCK	find . -exec rm -rf {} \;
BLOCK	ls | xargs rm -rf
BLOCK	FOO=1 rm -rf x
BLOCK	env -i rm -rf x
BLOCK	timeout 10 rm -rf x
BLOCK	echo $(rm -rf x)
BLOCK	git push -f
BLOCK	git push --force origin main
BLOCK	git push origin +main
BLOCK	git push -uf origin main
BLOCK	git -C . push --force
BLOCK	git reset --hard
BLOCK	git reset --hard HEAD~1
BLOCK	git reset HEAD~1 --hard
BLOCK	git -C /tmp/x reset --hard
BLOCK	sqlite3 app.db "DROP TABLE cards"
BLOCK	python -c "db.execute('drop database x')"
ALLOW	git push --force-with-lease
ALLOW	git push origin main
ALLOW	git push -u origin main
ALLOW	rm -r build
ALLOW	rm -f file.txt
ALLOW	rm file.txt
ALLOW	cat .env.example
ALLOW	cp .env.example .env
ALLOW	grep -r credentials docs/
ALLOW	git log --grep "drop table"
ALLOW	echo "git reset --hard is bad"
ALLOW	git commit -m "rm -rf old build; git push -f later"
ALLOW	git status
ALLOW	git reset --soft HEAD~1
ALLOW	npm run dev
ALLOW	flask --app run.py db upgrade
ALLOW	ls -rf
ALLOW	cat > notes.md <<'EOF'\nTo clean up, run rm -rf build\nand git push -f\nEOF
BLOCK	cat <<EOF > x.txt\nhello\nEOF\nrm -rf build
BLOCK	cat <<'EOF' | sh -c 'rm -rf x'\nbody\nEOF
ALLOW	git commit -m "$(cat <<'EOF'\nFix: remove rm -rf from docs\n\ngit reset --hard was wrong\nEOF\n)"
BLOCK	git commit -m "msg" && git push --force
ALLOW	sort < input.txt > out.txt
CASES

echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
