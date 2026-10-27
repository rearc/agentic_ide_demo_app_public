# Before Day 1: set up your machine

Day 1 uses two repos, Claude Code (both the CLI and the VS Code extension) and a small web app you run on your own machine. Work through this page before Day 1 and finish with the check at the bottom. If something fails, post in the workshop chat before Day 1. On the day you can hold off on that repo while someone helps you, and the workshop carries on. You first need the workshop app in Block 4.

**On Windows**, use **PowerShell or Git Bash**, whichever you prefer; where a command differs, both forms are given. Git for Windows must be installed either way: Claude Code and the workshop app's hooks run through its bash. Open a new terminal after every install, so it sees the new PATH. Nothing here needs admin rights except installing or upgrading Git for Windows or Node.

## 1. Install

### What you need

| What | Version |
|---|---|
| VS Code | 1.94 or later |
| Git (Windows: Git for Windows, which brings Git Bash) | Windows: a current Git for Windows; 2.24 and earlier can't sign in to GitHub |
| Python | 3.11 or later |
| Node.js | 22 or later |
| uv | any current |
| jq | any |
| Claude Code CLI | latest |
| Claude Code VS Code extension | latest |

### Mac

1. VS Code: install from code.visualstudio.com.

2. Git: comes with the Xcode Command Line Tools.

   ```bash
   xcode-select --install
   ```

3. Homebrew, if you don't have it: install from [brew.sh](https://brew.sh). The next three steps use it.

4. Python 3.12 (the system `python3` is often 3.9):

   ```bash
   brew install python@3.12
   ```

5. uv:

   ```bash
   brew install uv
   ```

6. jq: included in macOS 15 and later. On an earlier macOS:

   ```bash
   brew install jq
   ```

7. Node 22 through [nvm](https://github.com/nvm-sh/nvm). Install nvm:

   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
   ```

   Open a new terminal, then install Node 22 and make it your default:

   ```bash
   nvm install 22
   nvm alias default 22
   ```

   **Node 22 must be your nvm default** (`nvm alias default 22`), not just the version you switched to once. Claude runs commands in its own shell. If that shell starts on an older Node, the frontend tests stop with a `[STOP]` message.

8. Claude Code CLI:

   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   ```

9. Claude Code VS Code extension: in the Extensions view, search "Claude Code", or install `anthropic.claude-code`.

### Windows

1. VS Code: install from code.visualstudio.com.

2. Git for Windows: install a current version from [git-scm.com/downloads/win](https://git-scm.com/downloads/win). If you already have it, check the version; 2.24 and earlier can't sign in to GitHub, so update.

3. Python 3.12 (PowerShell):

   ```powershell
   winget install --id Python.Python.3.12 --scope user
   ```

4. Node LTS (PowerShell; no nvm needed):

   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

5. uv (PowerShell):

   ```powershell
   winget install --id astral-sh.uv
   ```

6. jq (PowerShell):

   ```powershell
   winget install jqlang.jq
   ```

7. Claude Code CLI (PowerShell):

   ```powershell
   irm https://claude.ai/install.ps1 | iex
   ```

   If that is blocked on your machine:

   ```powershell
   winget install Anthropic.ClaudeCode
   ```

8. Put the CLI on your PATH. The installer puts `claude.exe` in `%USERPROFILE%\.local\bin` but doesn't add that folder to your PATH. Add it to your user PATH (no admin needed), in PowerShell:

   ```powershell
   [Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";$env:USERPROFILE\.local\bin", "User")
   ```

   Or by hand: Settings > System > About > Advanced system settings > Environment Variables, then add `%USERPROFILE%\.local\bin` to the `Path` under "User variables". Either way, open a new terminal afterwards.

9. Claude Code VS Code extension: in the Extensions view, search "Claude Code", or install `anthropic.claude-code`.

> **Gotcha: PowerShell may refuse to run scripts.** If PowerShell says "running scripts is disabled on this system" (for example on `venv\Scripts\Activate.ps1`, `npm` or `npx`), tell a trainer before you change anything. The usual fix lets your own account run local scripts, with no admin needed:
>
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
>
> Your organization may manage this setting; if so, use Git Bash instead.

### Notes for everyone

- **Install the CLI as well as the extension.** The extension brings its own copy of Claude Code, but that copy doesn't put `claude` on your PATH, and the hands-on exercises run `claude` in VS Code's terminal.
- **Your Claude account:** Claude Code needs a paid Claude plan. Sign in with the account your organization gave you for the workshop. Every Claude model is allowed. Your organization may pin which Claude Code versions you can run; if a version is refused, tell us.
- **Python type checking (recommended):** with Node 22 active, run the command below so `pyright-langserver` is on your PATH. You'll add the Claude Code plugin that uses it in step 4.

  ```bash
  npm install -g pyright
  ```

## 2. Clone the two repos

1. Go to a folder of your choice.

2. Clone both repos:

   ```bash
   git clone https://github.com/rearc/agentic_ide_demo_app_public.git agentic_ide_demo_app
   git clone https://github.com/rearc/cabin-weekend-exercise.git
   ```

You work on branches in your local copy; nothing on Day 1 pushes. You can't push to the Rearc repos, so nothing you do reaches them by accident. To keep your work on GitHub, fork the workshop app and push there.

On Windows with an old Git for Windows, if the clone can't sign you in, update Git for Windows and try again.

## 3. One-time setup: the workshop app

Do this in your clone of `agentic_ide_demo_app`. The cabin exercise repo needs no setup.

### Backend

1. Go to the backend folder:

   ```bash
   cd backend
   ```

2. Create the virtual environment. Keep the folder name `venv`; the browser tests look for it.

   Mac:

   ```bash
   python3.12 -m venv venv
   ```

   Windows (PowerShell or Git Bash):

   ```powershell
   py -3.12 -m venv venv
   ```

3. Activate it.

   Mac:

   ```bash
   source venv/bin/activate
   ```

   Windows, PowerShell:

   ```powershell
   venv\Scripts\Activate.ps1
   ```

   If PowerShell says "running scripts is disabled on this system", see the gotcha at the end of step 1's Windows list and tell a trainer.

   Windows, Git Bash:

   ```bash
   source venv/Scripts/activate
   ```

4. Install the dependencies:

   ```bash
   pip install -r requirements-dev.txt
   ```

5. Build the database:

   ```bash
   flask --app run.py db upgrade
   ```

6. Seed it:

   ```bash
   python seed.py
   ```

### Frontend

1. Go to the frontend folder:

   ```bash
   cd ../frontend
   ```

2. Mac only: switch to Node 22 (skip this on Windows).

   ```bash
   nvm use
   ```

3. Install the dependencies:

   ```bash
   npm install
   ```

4. Install the browser the end-to-end tests and the UI check use:

   ```bash
   npx playwright install chromium
   ```

### Optional: the `.env` file

From the repo root, copy the example file. Both values in it are optional, and the app runs without the file.

Mac, or Windows Git Bash:

```bash
cp .env.example .env
```

Windows, PowerShell:

```powershell
Copy-Item .env.example .env
```

## 4. First launch in each repo

Open each repo folder in VS Code (File > Open Folder) and start Claude Code there once.

- **Signing in:** the first time, Claude Code opens your browser to sign in.
- **"Is this a project you created or one you trust?"** Choose **Yes**. The cursor starts on "No, exit", so move it first.
- **MCP servers (workshop app only):** Claude Code asks you to approve the project's MCP servers. Approve them.
- **LSP plugin recommendation (workshop app):** if you installed Pyright in step 1, choose **Yes, install**. If you didn't, choose **No, not now**. You can also install it yourself with `/plugin install pyright-lsp@claude-plugins-official`.
- **Later, during the workshop:** "Teach auto mode about your environment?" may appear. Choose **No**.

To open the extension, open any file, then click the Spark icon at the top right of the editor. The chat button may open Copilot instead; switch to Claude Code if it does.

## 5. The check

A short check that your machine works. Run each item in a new VS Code terminal (PowerShell or Git Bash on Windows); each one says what success looks like. The app's test suites run later, in the labs that use them.

### Tools

Run each command. Success is in the table.

```bash
claude --version
git --version
jq --version
node --version
uv --version
```

| Command | Success |
|---|---|
| `claude --version` | prints a version, e.g. `2.1.3xx (Claude Code)` |
| `git --version` | prints a version; on Windows, not 2.24 or earlier |
| `jq --version` | prints a version. Without jq the workshop app blocks every shell command Claude runs |
| `node --version` | `v22` or later |
| `uv --version` | prints a version |

### Cabin exercise repo

1. In `cabin-weekend-exercise`, run `claude`.
2. Send:

   ```
   What is this folder for? Answer in one sentence.
   ```

3. Success: one sentence about a workshop exercise.
4. Type `/exit`.

### Workshop app: running

Use two terminals.

1. Terminal 1, in `backend/`, with the venv active:

   ```bash
   python run.py
   ```

2. Terminal 2, in `frontend/`:

   ```bash
   npm run dev
   ```

3. Open http://localhost:5173.

   Success: the dashboard shows its cards, and the weather card shows real data.

### Workshop app: Claude Code (the CLI)

1. In the repo root, run `claude`.
2. Look at the status line under the prompt.

   Success: it reads `main checkout (main) | [<model>] ...`. If it says `jq missing`, install jq. On Windows, no status line usually means Git for Windows isn't installed.

3. Send:

   ```
   Run git status and tell me the branch in one sentence.
   ```

   Success: it runs the command with no red hook error and answers `main`.

4. Type `/exit`.

### Workshop app: the VS Code extension

1. Open a file in the workshop app and click the Spark icon.
2. Send:

   ```
   What is this repo? One sentence.
   ```

   Success: one sentence about a dashboard app.

**In the room:** post a ✅ in the workshop chat for each repo that passed.

Day 2 adds to this setup; you'll get its additions separately.
