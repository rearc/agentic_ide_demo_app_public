// Starts the backend for the Playwright suite on port 5011 (or E2E_BACKEND_PORT), on a throwaway
// database (backend/instance/e2e.db) that is rebuilt and seeded on every run.
// Plain Node so it behaves the same on macOS, Linux and Windows.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.E2E_BACKEND_PORT ?? 5011)
const backend = fileURLToPath(new URL('../../backend/', import.meta.url))
const python =
  process.platform === 'win32' ? 'venv/Scripts/python.exe' : 'venv/bin/python'
const options = { cwd: backend, stdio: 'inherit' }

const database = `${backend}instance/e2e.db`
if (existsSync(database)) rmSync(database)

execFileSync(
  python,
  [
    '-m',
    'flask',
    '--app',
    "app:create_app('config.E2EConfig')",
    'db',
    'upgrade',
  ],
  options,
)

// No debug reloader: it would fork a second process Playwright cannot stop.
const serve = `
from app import create_app
from seed import seed

app = create_app('config.E2EConfig')
seed(app, reset=True)
app.run(port=${PORT}, debug=False)
`
spawn(python, ['-c', serve], options).on('exit', (code) =>
  process.exit(code ?? 0),
)
