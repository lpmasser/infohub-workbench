import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  readFile,
  writeFile,
  readdir,
  mkdir,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (process.platform !== "win32")
  throw new Error("Run on a native Windows runner.");
const bundles = path.resolve(process.argv[2]);
const core = path.resolve(process.argv[3]);
const installers = (await readdir(bundles)).filter((name) =>
  name.endsWith("-setup.exe"),
);
assert.equal(installers.length, 1);
const temporary = await mkdtemp(path.join(tmpdir(), "infohub-native-smoke-"));
const app = path.join(temporary, "app");
const root = path.join(temporary, "workspace");
const remote = path.join(temporary, "remote.git");
const env = { ...process.env };
const run = (command, args, cwd = temporary) =>
  execFileSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
const git = (args, cwd) => run("git", args, cwd).trim();
const until = async (predicate, label) => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out: ${label}`);
};
let child;
// Match Tauri's Windows known-folder lookup; USERPROFILE overrides affect
// Node but not SHGetKnownFolderPath used by the native application.
const profile = run("powershell.exe", [
  "-NoProfile",
  "-NonInteractive",
  "-Command",
  "[Environment]::GetFolderPath('UserProfile')",
]).trim();
const configFile = path.join(profile, ".config/infohub/config.json");
const previousConfig = await readFile(configFile).catch((error) => {
  if (error.code !== "ENOENT") throw error;
  return null;
});
try {
  await mkdir(path.dirname(configFile), { recursive: true });
  git(["init", "--bare", "--initial-branch=main", remote]);
  git(["clone", remote, root]);
  await mkdir(path.join(root, "ontology"));
  await mkdir(path.join(root, "docs"));
  await writeFile(
    path.join(root, "ontology/ontology.json"),
    JSON.stringify({
      folders: ["docs"],
      primaryKey: "ontology_id",
      properties: {
        ontology_id: { type: "text", required: true },
        ontology_type: { type: "text", required: true },
        title: { type: "text", required: true },
      },
      objectTypes: { project: { properties: {} } },
      relations: {},
    }),
  );
  await writeFile(
    path.join(root, "docs/project.md"),
    "---\nontology_id: project-00000001\nontology_type: project\ntitle: Smoke project\n---\n",
  );
  git(["add", "."], root);
  git(
    [
      "-c",
      "user.name=Smoke",
      "-c",
      "user.email=smoke@example.invalid",
      "commit",
      "-m",
      "fixture",
    ],
    root,
  );
  git(["push", "origin", "main"], root);
  const { scanDrafts } = await import(
    pathToFileURL(path.join(core, "server/drafts.mjs")).href
  );
  await scanDrafts(remote, path.join(temporary, "draft-state"));
  const gitPath = run("where.exe", ["git.exe"]).trim().split(/\r?\n/)[0];
  const cli = path.join(core, "cli/infohub.mjs");
  await writeFile(
    configFile,
    JSON.stringify({
      root,
      runtime: { node: process.execPath, git: gitPath, cli },
    }),
  );
  const query = (command) =>
    JSON.parse(run(process.execPath, [cli, "--root", root, ...command]));
  assert.equal(query(["overview"]).projects[0].title, "Smoke project");
  run(path.join(bundles, installers[0]), ["/S", `/D=${app}`]);
  const binary = path.join(app, "infohub-workbench.exe");
  const identity = JSON.parse(
    await readFile(path.join(app, "infohub-build.json"), "utf8"),
  );
  assert.equal(
    identity.commit,
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  );
  child = spawn(binary, ["--background"], {
    env,
    windowsHide: true,
    stdio: "ignore",
  });
  await until(
    () => query(["sync", "status"]).running,
    "desktop owns synchronization",
  );
  const running = query(["sync", "status"]);
  run(binary, ["--quit"]);
  await until(() => child.exitCode !== null, "safe quit");
  await until(() => !query(["sync", "status"]).running, "synchronizer stopped");
  await writeFile(
    "windows-smoke.json",
    JSON.stringify(
      {
        installer: installers[0],
        commit: identity.commit,
        installed: true,
        backgroundStarted: true,
        syncPid: running.pid,
        safeQuit: true,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  // Only this test's process may be killed after a failed assertion.
  if (child && child.exitCode === null)
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
    });
  const uninstaller = (await readdir(app).catch(() => [])).find((name) =>
    /^uninstall.*\.exe$/i.test(name),
  );
  if (uninstaller)
    spawnSync(path.join(app, uninstaller), ["/S"], { windowsHide: true });
  if (previousConfig === null) await rm(configFile, { force: true });
  else await writeFile(configFile, previousConfig);
  await rm(temporary, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 250,
  });
}
