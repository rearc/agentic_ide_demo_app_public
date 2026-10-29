# Set up your machine for the workshop

Day 1 uses two repos, Claude Code (both the CLI and the VS Code extension) and a small web app you run on your own machine. You do Part 1 yourself, with the trainer: clone the two repos, open the workshop app in VS Code and start Claude Code there. Then you hand this file to Claude Code, and it does Part 2: installs what's missing, sets up the app and runs the check. If something fails, post in the workshop chat. You can hold off on it while someone helps you, and the workshop carries on.

**On Windows**, use **PowerShell or Git Bash**, whichever you prefer; where a command differs, both forms are given. Git for Windows must be installed either way: Claude Code and the workshop app's hooks run through its bash. Open a new terminal after every install, so it sees the new PATH. Nothing here needs admin rights except installing or upgrading Git for Windows or Node.

# Part 1: do these yourself

## 1. Clone the two repos

1. Go to a folder of your choice.

2. Clone both repos:

   ```bash
   git clone https://github.com/rearc/agentic_ide_demo_app_public.git agentic_ide_demo_app
   git clone https://github.com/rearc/cabin-weekend-exercise.git
   ```

The cabin exercise repo needs no setup. Keep it cloned: later in the workshop you open it and work in it with Claude Code.

You work on branches in your local copy; nothing on Day 1 pushes. You can't push to the Rearc repos, so nothing you do reaches them by accident. To keep your work on GitHub, fork the workshop app and push there.

On Windows with an old Git for Windows, if the clone can't sign you in, update Git for Windows and try again.

## 2. Open the workshop app and start Claude Code

1. Open the `agentic_ide_demo_app` folder in VS Code (File > Open Folder).
2. The extension: if you don't have it, install it from the Extensions view (search "Claude Code", or `anthropic.claude-code`). To open it, open any file, then click the Spark icon at the top right of the editor. The chat button may open Copilot instead; switch to Claude Code if it does.
3. The CLI: open VS Code's terminal (in the repo folder) and run `claude`. It's the same Claude Code as the extension, working in the same repo.

The first time you start Claude Code in the repo:

- **Signing in:** Claude Code opens your browser to sign in. Use the account your organization gave you for the workshop. Every Claude model is allowed. Your organization may pin which Claude Code versions you can run; if a version is refused, tell us.
- **"Is this a project you created or one you trust?"** Choose **Yes**. The cursor starts on "No, exit", so move it first.
- **MCP servers:** Claude Code asks you to approve the project's MCP servers. Approve them.
- **LSP plugin recommendation:** choose **No, not now**. Part 2 installs Pyright; add the plugin afterwards with `/plugin install pyright-lsp@claude-plugins-official`.
- **Later, during the workshop:** "Teach auto mode about your environment?" may appear. Choose **No**.

## 3. Hand Part 2 to Claude Code

In Claude Code (either one), in the workshop app, send:

```
Follow Part 2 of SETUP.md to set up this machine for the workshop. The repos are already cloned. Install what's missing, do the one-time setup for this app, then run the check and report what passed and what didn't. Tell me before anything needs admin rights.
```

Then do the check's last part ("Your part") yourself, and post a ✅ in the workshop chat when it passes.

# Part 2: Claude Code sets up the machine

## 4. Install

### What you need

| What | Version |
|---|---|
| Git (Windows: Git for Windows, which brings Git Bash) | Windows: a current Git for Windows; 2.24 and earlier can't sign in to GitHub |
| Python | 3.11 or later |
| Node.js | 22 or later |
| uv | any current |
| jq | any |

VS Code and Claude Code (the CLI and the extension) are already installed.

### Mac

1. Git: comes with the Xcode Command Line Tools.

   ```bash
   xcode-select --install
   ```

2. Homebrew, if you don't have it: install from [brew.sh](https://brew.sh). The next steps use it.

3. Python 3.12 (the system `python3` is often 3.9):

   ```bash
   brew install python@3.12
   ```

4. uv:

   ```bash
   brew install uv
   ```

5. jq: included in macOS 15 and later. On an earlier macOS:

   ```bash
   brew install jq
   ```

6. Node 22 through [nvm](https://github.com/nvm-sh/nvm). Install nvm:

   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
   ```

   Open a new terminal, then install Node 22 and make it your default:

   ```bash
   nvm install 22
   nvm alias default 22
   ```

   **Node 22 must be your nvm default** (`nvm alias default 22`), not just the version you switched to once. Claude runs commands in its own shell. If that shell starts on an older Node, the frontend tests stop with a `[STOP]` message.

### Windows

1. Git for Windows: install a current version from [git-scm.com/downloads/win](https://git-scm.com/downloads/win). If you already have it, check the version; 2.24 and earlier can't sign in to GitHub, so update.

2. Python 3.12 (PowerShell):

   ```powershell
   winget install --id Python.Python.3.12 --scope user
   ```

3. Node LTS (PowerShell; no nvm needed):

   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

4. uv (PowerShell):

   ```powershell
   winget install --id astral-sh.uv
   ```

5. jq (PowerShell):

   ```powershell
   winget install jqlang.jq
   ```

> **Gotcha: PowerShell may refuse to run scripts.** If PowerShell says "running scripts is disabled on this system" (for example on `venv\Scripts\Activate.ps1`, `npm` or `npx`), tell a trainer before you change anything. The usual fix lets your own account run local scripts, with no admin needed:
>
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
>
> Your organization may manage this setting; if so, use Git Bash instead.

### Python type checking (recommended)

With Node 22 active, run the command below so `pyright-langserver` is on your PATH. The person adds the Claude Code plugin that uses it afterwards (Part 1, step 2).

```bash
npm install -g pyright
```

## 5. One-time setup: the workshop app

Do this in your clone of `agentic_ide_demo_app`.

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

## 6. The check

A short check that your machine works; each item says what success looks like. Claude Code runs the tools check and starts the app; the last part is the person's. The app's test suites run later, in the labs that use them.

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

### The app, running

Start both servers in the background (they keep running while you work), then check them.

1. The backend, in `backend/`, with the venv active:

   ```bash
   python run.py
   ```

2. The frontend, in `frontend/`:

   ```bash
   npm run dev
   ```

3. Success: http://localhost:5001/api/cards answers with JSON, and http://localhost:5173 serves the page. Then tell the person to open http://localhost:5173: the dashboard shows its cards, and the weather card shows real data. Leave both servers running.

### Your part

Do these yourself: they check what you see, which Claude Code can't.

#### The app in your browser

Open http://localhost:5173 (Claude Code started the servers). Success: the dashboard shows its cards, and the weather card shows real data.

#### The CLI

1. In the repo root, in a new terminal, run `claude`.
2. Look at the status line under the prompt.

   Success: it reads `main checkout (main) | [<model>] ...`. If it says `jq missing`, install jq. On Windows, no status line usually means Git for Windows isn't installed.

3. Send:

   ```
   Run git status and tell me the branch in one sentence.
   ```

   Success: it runs the command with no red hook error and answers `main`.

4. Type `/exit`.

#### The VS Code extension

1. Open a file in the workshop app and click the Spark icon.
2. Send:

   ```
   What is this repo? One sentence.
   ```

   Success: one sentence about a dashboard app.

**In the room:** post a ✅ in the workshop chat when the check passes.

Day 2 adds to this setup; you'll get its additions separately.
