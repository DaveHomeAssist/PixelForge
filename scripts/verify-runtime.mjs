const [, , ...args] = process.argv;

const requireNpm = args.includes("--require-npm");
const [nodeMajor] = process.versions.node.split(".").map(Number);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (nodeMajor < 22 || nodeMajor >= 25) {
  fail(
    [
      "PixelForge requires Node 22, 23, or 24.",
      `Detected Node ${process.versions.node}.`,
      "Switch to the pinned runtime from `.nvmrc` / `.node-version` before installing or running project scripts.",
    ].join("\n"),
  );
}

const userAgent = process.env.npm_config_user_agent ?? "";
const npmMatch = userAgent.match(/\bnpm\/(\d+)\./);

if (requireNpm && !npmMatch) {
  fail("PixelForge install checks expect npm 10+.");
}

if (npmMatch) {
  const npmMajor = Number(npmMatch[1]);

  if (npmMajor < 10) {
    fail(
      [
        "PixelForge requires npm 10 or newer.",
        `Detected ${npmMatch[0].split(" ")[0].replace("/", " ")}.`,
      ].join("\n"),
    );
  }
}
