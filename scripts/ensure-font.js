#!/usr/bin/env node
"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const JSZip = require("jszip");

const FONT_FAMILY = "Noto Serif SC";
const OFFICIAL_RELEASE_URL =
  "https://github.com/notofonts/noto-cjk/releases/download/Serif2.003/14_NotoSerifSC.zip";
const FONT_FILE_PATTERN = /^NotoSerifSC-(?:ExtraLight|Light|Regular|Medium|SemiBold|Bold|Black)\.otf$/i;
const checkOnly = process.argv.includes("--check");

function commandExists(command) {
  const result = process.platform === "win32"
    ? childProcess.spawnSync("where.exe", [command], { stdio: "ignore" })
    : childProcess.spawnSync("/usr/bin/env", ["sh", "-lc", `command -v ${command}`], {
        stdio: "ignore",
      });
  return result.status === 0;
}

function fontDirectories() {
  return [
    path.join(os.homedir(), "Library", "Fonts"),
    "/Library/Fonts",
    "/System/Library/Fonts",
    path.join(os.homedir(), ".local", "share", "fonts"),
    "/usr/local/share/fonts",
    "/usr/share/fonts",
    process.env.WINDIR ? path.join(process.env.WINDIR, "Fonts") : "",
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Microsoft", "Windows", "Fonts") : "",
  ].filter(Boolean);
}

function directoryContainsFont(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.some((entry) => {
      if (entry.isFile()) return /^NotoSerifSC.*\.(?:otf|ttf|ttc)$/i.test(entry.name);
      if (!entry.isDirectory()) return false;
      try {
        return fs.readdirSync(path.join(dir, entry.name)).some((name) =>
          /^NotoSerifSC.*\.(?:otf|ttf|ttc)$/i.test(name)
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function fontFilesExist() {
  return fontDirectories().some(directoryContainsFont);
}

function fontconfigHasFamily() {
  if (!commandExists("fc-list")) return false;
  try {
    const families = childProcess.execFileSync("fc-list", ["-f", "%{family}\n"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return families.split(/\r?\n/).some((line) =>
      line.split(",").some((family) => family.trim() === FONT_FAMILY)
    );
  } catch {
    return false;
  }
}

function hasFont() {
  return fontFilesExist() || fontconfigHasFamily();
}

function targetFontDirectory() {
  if (process.platform === "win32") {
    if (!process.env.LOCALAPPDATA) throw new Error("找不到 LOCALAPPDATA，无法定位当前用户字体目录");
    return path.join(process.env.LOCALAPPDATA, "Microsoft", "Windows", "Fonts");
  }
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Fonts");
  return path.join(os.homedir(), ".local", "share", "fonts", "NotoSerifSC");
}

function registerWindowsFont(filePath) {
  const registryKey = "HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts";
  const fontName = `${path.basename(filePath, path.extname(filePath))} (OpenType)`;
  const result = childProcess.spawnSync(
    "reg.exe",
    ["add", registryKey, "/v", fontName, "/t", "REG_SZ", "/d", filePath, "/f"],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `注册字体失败：${fontName}`).trim());
  }
}

async function installOfficialStaticFonts() {
  console.log(`未检测到 ${FONT_FAMILY}，正在从 Noto 官方仓库下载静态简体中文字重……`);
  const response = await fetch(OFFICIAL_RELEASE_URL, { redirect: "follow" });
  if (!response.ok) throw new Error(`官方字体下载失败：HTTP ${response.status}`);

  const archive = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
  const fontEntries = Object.values(archive.files).filter((entry) =>
    !entry.dir && FONT_FILE_PATTERN.test(path.basename(entry.name))
  );
  if (fontEntries.length === 0) throw new Error("官方字体包中未找到预期的 Noto Serif SC 静态 OTF 文件");

  const targetDir = targetFontDirectory();
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fontEntries) {
    const targetPath = path.join(targetDir, path.basename(entry.name));
    fs.writeFileSync(targetPath, await entry.async("nodebuffer"));
    if (process.platform === "win32") registerWindowsFont(targetPath);
  }

  if (process.platform !== "win32" && commandExists("fc-cache")) {
    childProcess.spawnSync("fc-cache", ["-f"], { stdio: "ignore" });
  }
  console.log(`已安装 ${fontEntries.length} 个静态字重到：${targetDir}`);
}

async function main() {
  if (hasFont()) {
    console.log(`${FONT_FAMILY} 已安装。`);
    return;
  }

  if (checkOnly) {
    console.error(`${FONT_FAMILY} 未安装。`);
    process.exitCode = 1;
    return;
  }

  try {
    await installOfficialStaticFonts();
  } catch (error) {
    console.error(`${FONT_FAMILY} 自动安装失败：${error.message}`);
    console.error(`请检查网络与当前用户字体目录权限后重试。官方来源：${OFFICIAL_RELEASE_URL}`);
    process.exitCode = 1;
    return;
  }

  if (!hasFont()) {
    console.error(`${FONT_FAMILY} 文件已写入，但系统尚未识别。请重新打开浏览器后再运行转换。`);
    process.exitCode = 1;
    return;
  }
  console.log(`${FONT_FAMILY} 安装并验证成功；若浏览器已打开，请重新打开后再预览。`);
}

main().catch((error) => {
  console.error(`${FONT_FAMILY} 检查失败：${error.message}`);
  process.exitCode = 1;
});
