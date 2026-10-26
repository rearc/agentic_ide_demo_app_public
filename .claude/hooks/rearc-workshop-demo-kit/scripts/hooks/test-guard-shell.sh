#!/usr/bin/env bash
# =============================================================================
# test-guard-shell.sh - checks guard-shell.sh against commands it must block
# or allow. Run it after changing the guard, and once on each platform
# (macOS /bin/bash 3.2, Git Bash on Windows). The PowerShell cases are the forms
# Claude sends through its PowerShell tool on Windows:
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
  # MSYS_NO_PATHCONV: Git Bash would otherwise rewrite "/bin/rm" into a Windows path
  # on its way to jq.exe; Claude Code hands the guard the command untouched.
  out=$(MSYS_NO_PATHCONV=1 jq -n --arg c "$cmd" '{tool_name: "Bash", tool_input: {command: $c}}' | bash "$GUARD")
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
BLOCK	Remove-Item -Recurse -Force build
BLOCK	Remove-Item build -Recurse -Force
BLOCK	Remove-Item -Path .\\build -Recurse -Force
BLOCK	remove-item -r -fo build
BLOCK	ri -Recurse -Force build
BLOCK	del -Recurse -Force build
BLOCK	erase -r -force build
BLOCK	rmdir -Recurse -Force build
BLOCK	rm -Recurse -Force build
BLOCK	rm -r -fo build
BLOCK	Get-ChildItem build | Remove-Item -Recurse -Force
BLOCK	cd backend; Remove-Item -Recurse -Force venv
BLOCK	Remove-Item -Recurse -Force:$true build
BLOCK	powershell -Command "Remove-Item -Recurse -Force build"
BLOCK	pwsh -c "rm -r -fo build"
BLOCK	cmd /c "rd /s /q build"
BLOCK	cmd /c rd /s /q build
BLOCK	cmd /c "del /s /q build"
BLOCK	powershell -Command "git reset --hard"
BLOCK	git push --force; Write-Output done
ALLOW	Remove-Item build.txt
ALLOW	Remove-Item -Recurse build
ALLOW	Remove-Item -Force file.txt
ALLOW	del file.txt
ALLOW	rd build
ALLOW	cmd /c "rd /s build"
ALLOW	Write-Output "Remove-Item -Recurse -Force build"
ALLOW	Get-ChildItem -Recurse -Force
ALLOW	powershell -Command "Get-ChildItem"
BLOCK	echo hi\r\ngit reset --hard\r\necho done
BLOCK	cat <<EOF > x.txt\r\nhello\r\nEOF\r\nrm -rf build
ALLOW	Write-Output "DROP TABLE cards is in the old migration"
ALLOW	Select-String -Pattern "drop table" -Path docs\\*.md
BLOCK	python seed.py --reset
BLOCK	python backend/seed.py --reset
BLOCK	cd backend && python seed.py --reset
BLOCK	python3 seed.py --reset
BLOCK	.\\venv\\Scripts\\python.exe seed.py --reset
BLOCK	& .\\venv\\Scripts\\python.exe backend\\seed.py --reset
BLOCK	venv/bin/python seed.py --reset
BLOCK	py -3 seed.py --reset
BLOCK	uv run python seed.py --reset
BLOCK	python seed.py --res
BLOCK	./seed.py --reset
BLOCK	powershell -Command "python seed.py --reset"
BLOCK	rm backend/instance/app.db
BLOCK	rm -f instance/app.db
BLOCK	Remove-Item backend\\instance\\app.db
BLOCK	del instance\\app.db
ALLOW	python seed.py
ALLOW	python backend/seed.py
ALLOW	.\\venv\\Scripts\\python.exe seed.py
ALLOW	echo "python seed.py --reset"
ALLOW	git commit -m "never run seed.py --reset without asking"
ALLOW	python run.py --reset
ALLOW	ls instance/app.db
ALLOW	rm instance/old.txt
CASES

echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
