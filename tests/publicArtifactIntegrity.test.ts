import { createRequire } from "node:module";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const verifier = require("../scripts/verify-public-artifacts.cjs") as {
  PROHIBITED: string;
  collectSourceMatches(root: string): string[];
  main(
    argv?: string[],
    root?: string,
    dependencies?: {
      validatePackage?: (root: string, packageDirectory: string) => void;
    }
  ): string;
  normalizeArtifactPath(value: unknown): string;
  parseArguments(argv: string[]): {
    packageDirectories: string[];
    sourceOnly: boolean;
  };
  run(command: string, args: string[], options?: { cwd?: string }): string;
  validatePackage(
    root: string,
    packageDirectory: string,
    execute?: (
      command: string,
      args: string[],
      options: { cwd: string }
    ) => string
  ): void;
  validatePackageDirectory(root: string, packageDirectory: string): string;
};

const temporaryRoots: string[] = [];

function temporaryDirectory(label: string): string {
  const root = mkdtempSync(join(tmpdir(), `renderer-${label}-`));
  temporaryRoots.push(root);
  return root;
}

function initializeRepository(root: string): void {
  const result = spawnSync("git", ["init", "--quiet"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr);
  }
}

function createPackageRepository(label: string): string {
  const root = temporaryDirectory(label);
  initializeRepository(root);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: `renderer-${label}`,
      version: "1.0.0",
      files: ["index.js"],
    })
  );
  writeFileSync(join(root, "index.js"), "export const safe = true;\n");
  return root;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("public artifact path normalization", () => {
  it("normalizes archive prefixes, case, slash variants, dot segments, and Unicode", () => {
    expect(verifier.PROHIBITED).toBe("legal/cla-registry.csv");
    expect(
      verifier.normalizeArtifactPath(
        ".\\PACKAGE\\legal\\folder\\..\\CLA-REGISTRY.csv"
      )
    ).toBe("legal/cla-registry.csv");
    expect(
      verifier.normalizeArtifactPath("package/legal/CLA-REGISTRY.csv")
    ).toBe("legal/cla-registry.csv");
    expect(
      verifier.normalizeArtifactPath(
        "package/legal/ＣＬＡ-ＲＥＧＩＳＴＲＹ.csv"
      )
    ).toBe("legal/cla-registry.csv");
    expect(verifier.normalizeArtifactPath(42)).toBe("42");
  });
});

describe("public artifact CLI arguments", () => {
  it("defaults to the repository package and accepts multiple package roots", () => {
    expect(verifier.parseArguments([])).toEqual({
      packageDirectories: ["."],
      sourceOnly: false,
    });
    expect(
      verifier.parseArguments([
        "--package-dir",
        "packages/a",
        "--package-dir",
        "packages/b",
      ])
    ).toEqual({
      packageDirectories: ["packages/a", "packages/b"],
      sourceOnly: false,
    });
    expect(verifier.parseArguments(["--source-only"])).toEqual({
      packageDirectories: [],
      sourceOnly: true,
    });
  });

  it("rejects missing, unknown, and conflicting arguments", () => {
    expect(() => verifier.parseArguments(["--package-dir"])).toThrow(
      "--package-dir requires a value"
    );
    expect(() =>
      verifier.parseArguments(["--package-dir", "--source-only"])
    ).toThrow("--package-dir requires a value");
    expect(() => verifier.parseArguments(["--unknown"])).toThrow(
      "Unknown argument"
    );
    expect(() =>
      verifier.parseArguments(["--source-only", "--package-dir", "."])
    ).toThrow("--source-only cannot be combined");
  });
});

describe("source metadata admission", () => {
  it("accepts a repository with no prohibited source metadata", () => {
    const root = createPackageRepository("source-safe");
    expect(verifier.collectSourceMatches(root)).toEqual([]);
  });

  it("detects case-normalized filesystem and Git-index metadata without reading content", () => {
    const root = createPackageRepository("source-match");
    mkdirSync(join(root, "legal"));
    const prohibited = join(root, "legal", "CLA-Registry.csv");
    writeFileSync(prohibited, "synthetic fixture that must not be read");
    const add = spawnSync("git", ["add", "legal/CLA-Registry.csv"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(add.status).toBe(0);
    chmodSync(prohibited, 0o000);

    expect(verifier.collectSourceMatches(root)).toEqual([
      "legal/CLA-Registry.csv",
    ]);
  });

  it("fails closed when the legal root is a symlink or not a directory", () => {
    const symlinkRoot = createPackageRepository("legal-symlink");
    const outside = temporaryDirectory("legal-outside");
    symlinkSync(outside, join(symlinkRoot, "legal"));
    expect(() => verifier.collectSourceMatches(symlinkRoot)).toThrow(
      "legal path is a symlink"
    );

    const fileRoot = createPackageRepository("legal-file");
    writeFileSync(join(fileRoot, "legal"), "not a directory");
    expect(() => verifier.collectSourceMatches(fileRoot)).toThrow(
      "legal path is not a directory"
    );
  });

  it("aborts before package validation when prohibited metadata exists", () => {
    const root = createPackageRepository("abort-before-pack");
    mkdirSync(join(root, "legal"));
    writeFileSync(join(root, "legal", "CLA-REGISTRY.csv"), "");
    const validatePackage = vi.fn();

    expect(() =>
      verifier.main(["--package-dir", "."], root, { validatePackage })
    ).toThrow("Source contains prohibited path metadata");
    expect(validatePackage).not.toHaveBeenCalled();
  });
});

describe("package inventory admission", () => {
  it("rejects traversal, aliases, package symlinks, and manifest symlinks", () => {
    const root = createPackageRepository("containment");
    expect(verifier.validatePackageDirectory(root, ".")).toBe(root);
    expect(() => verifier.validatePackageDirectory(root, "./")).toThrow(
      "escapes repository root"
    );
    expect(() => verifier.validatePackageDirectory(root, "../outside")).toThrow(
      "escapes repository root"
    );

    const outside = temporaryDirectory("package-outside");
    writeFileSync(
      join(outside, "package.json"),
      JSON.stringify({ name: "outside", version: "1.0.0" })
    );
    symlinkSync(outside, join(root, "linked-package"));
    expect(() =>
      verifier.validatePackageDirectory(root, "linked-package")
    ).toThrow("not a regular directory");

    const packageDirectory = join(root, "package");
    mkdirSync(packageDirectory);
    symlinkSync(
      join(outside, "package.json"),
      join(packageDirectory, "package.json")
    );
    expect(() => verifier.validatePackageDirectory(root, "package")).toThrow(
      "manifest is not a regular file"
    );
  });

  it("accepts a real npm inventory for a clean package", () => {
    const root = createPackageRepository("real-pack");
    const previousCache = process.env.npm_config_cache;
    process.env.npm_config_cache = temporaryDirectory("npm-cache");
    try {
      expect(() => verifier.validatePackage(root, ".")).not.toThrow();
    } finally {
      if (previousCache === undefined) {
        delete process.env.npm_config_cache;
      } else {
        process.env.npm_config_cache = previousCache;
      }
    }
  });

  it("validates npm JSON shape and rejects prohibited inventory metadata", () => {
    const root = createPackageRepository("inventory-shape");
    const execute = vi.fn();

    execute.mockReturnValueOnce("not json");
    expect(() => verifier.validatePackage(root, ".", execute)).toThrow(
      "npm pack did not return valid JSON"
    );

    execute.mockReturnValueOnce("[]");
    expect(() => verifier.validatePackage(root, ".", execute)).toThrow(
      "unexpected result shape"
    );

    execute.mockReturnValueOnce('[{"name":"x"}]');
    expect(() => verifier.validatePackage(root, ".", execute)).toThrow(
      "did not include a file inventory"
    );

    execute.mockReturnValueOnce(
      JSON.stringify([
        {
          files: [
            { path: "README.md" },
            { path: null },
            { path: "package/legal/CLA-REGISTRY.csv" },
          ],
        },
      ])
    );
    expect(() => verifier.validatePackage(root, ".", execute)).toThrow(
      "contains prohibited path metadata"
    );

    execute.mockReturnValueOnce(
      JSON.stringify([{ files: [{ path: "README.md" }] }])
    );
    expect(() => verifier.validatePackage(root, ".", execute)).not.toThrow();
  });
});

describe("verifier orchestration and process failures", () => {
  it("supports source-only and validates every requested package", () => {
    const root = createPackageRepository("orchestration");
    const validatePackage = vi.fn();

    expect(verifier.main(["--source-only"], root, { validatePackage })).toContain(
      "source metadata checked"
    );
    expect(validatePackage).not.toHaveBeenCalled();

    expect(
      verifier.main(
        ["--package-dir", ".", "--package-dir", "packages/example"],
        root,
        { validatePackage }
      )
    ).toContain("2 npm package inventory check(s) passed");
    expect(validatePackage).toHaveBeenNthCalledWith(1, root, ".");
    expect(validatePackage).toHaveBeenNthCalledWith(
      2,
      root,
      "packages/example"
    );
  });

  it("reports spawn failures without masking them when stderr is unavailable", () => {
    expect(() =>
      verifier.run("renderer-command-that-does-not-exist", [])
    ).toThrow("renderer-command-that-does-not-exist failed");
  });
});
