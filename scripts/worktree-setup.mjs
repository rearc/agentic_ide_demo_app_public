// Makes a git worktree of this repo runnable on its own, beside the main
// checkout and any other worktree:
//
//   node scripts/worktree-setup.mjs
//
// Run from the worktree's root. A worktree checks out tracked files only, so
// this links the main checkout's backend venv and frontend node_modules into
// it, builds the worktree's own database (backend/instance/app.db, migrated
// and seeded), and picks four free ports into .dev-ports, which run.py, the
// Vite config, the end-to-end suite and check-ui read. Safe to run again: it
// skips what is already there and prints the ports.
//
// Plain Node so it behaves the same on macOS, Linux and Windows (on Windows
// the links are directory junctions, which need no admin rights).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const commonDir = resolve(
  root,
  execFileSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
);
const main = dirname(commonDir);
const isWorktree = resolve(main) !== resolve(root);

function link(rel) {
  const target = join(main, rel);
  const path = join(root, rel);
  if (existsSync(path)) return console.log(`${rel}: already there`);
  if (!existsSync(target))
    throw new Error(
      `${target} is missing: set up the main checkout first (README, "Setup")`,
    );
  symlinkSync(target, path, process.platform === "win32" ? "junction" : "dir");
  console.log(`${rel}: linked to the main checkout's`);
}

if (isWorktree) {
  link("backend/venv");
  link("frontend/node_modules");
}

const backend = join(root, "backend");
const python = join(
  backend,
  process.platform === "win32" ? "venv/Scripts/python.exe" : "venv/bin/python",
);
if (existsSync(join(backend, "instance/app.db"))) {
  console.log("database: already there");
} else {
  execFileSync(python, ["-m", "flask", "--app", "run.py", "db", "upgrade"], {
    cwd: backend,
    stdio: "inherit",
  });
  execFileSync(python, ["seed.py"], { cwd: backend, stdio: "inherit" });
  console.log(
    "database: built and seeded (backend/instance/app.db, this checkout only)",
  );
}

function freePort() {
  return new Promise((done, fail) => {
    const server = createServer();
    server.on("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });
}

const portsFile = join(root, ".dev-ports");
if (!existsSync(portsFile)) {
  const [backendPort, frontendPort, e2eBackend, e2eFrontend] = [
    await freePort(),
    await freePort(),
    await freePort(),
    await freePort(),
  ];
  writeFileSync(
    portsFile,
    [
      `BACKEND_PORT=${backendPort}`,
      `FRONTEND_PORT=${frontendPort}`,
      `E2E_BACKEND_PORT=${e2eBackend}`,
      `E2E_FRONTEND_PORT=${e2eFrontend}`,
      "",
    ].join("\n"),
  );
}
const ports = readFileSync(portsFile, "utf8").trim();
console.log(`ports (.dev-ports):\n${ports}`);
const front = /^FRONTEND_PORT=(\d+)/m.exec(ports)[1];
console.log(`the app, once both dev servers run: http://localhost:${front}`);
