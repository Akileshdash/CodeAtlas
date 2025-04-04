import * as vscode from "vscode";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";

function findGitRoot(filePath: string): string | null {
  /**
   * @param filePath - The path to the file for which to find the Git root.
   * @returns The root directory of the Git repository, or null if not found.
   * Find the root directory of the Git repository for the given file path.
   */
  let dir = path.dirname(filePath);
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, ".git"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

export function registerGitBlame(context: vscode.ExtensionContext) {
  /**
   * @param context - The extension context.
   * @returns {void}
   * This function registers a command that, when executed, retrieves the Git blame information for the currently active file in the editor.
   */
  const decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor("editorCodeLens.foreground"),
      margin: "0 0 0 2em",
      fontWeight: "500",
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });

  let disposable = vscode.commands.registerCommand(
    "CodeAtlas.showGitBlame",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found!");
        return;
      }

      const filePath = editor.document.uri.fsPath;
      const gitRoot = findGitRoot(filePath);

      if (!gitRoot) {
        vscode.window.showErrorMessage("No Git repository found!");
        return;
      }

      process.chdir(gitRoot);

      exec(
        `git blame --line-porcelain "${filePath}"`,
        (error, stdout, stderr) => {
          if (error) {
            vscode.window.showErrorMessage(
              `Error running git blame: ${stderr}`
            );
            return;
          }
          const blameData = parseBlameOutput(stdout);

          applyBlameDecorations(editor, blameData, decorationType);
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

function applyBlameDecorations(
  editor: vscode.TextEditor,
  blameData: Record<number, string>,
  decorationType: vscode.TextEditorDecorationType
) {
  /**
   * @param editor - The active text editor.
   * @param blameData - The parsed Git blame data.
   * @param decorationType - The decoration type for the blame information.
   * @returns {void}
   * This function applies the blame decorations to the editor based on the provided blame data.
   */
  const decorations: vscode.DecorationOptions[] = [];

  for (const [lineNumber, metadata] of Object.entries(blameData)) {
    const lineIndex = parseInt(lineNumber);

    if (lineIndex >= editor.document.lineCount) continue;

    const line = editor.document.lineAt(lineIndex);
    const range = new vscode.Range(line.range.end, line.range.end);

    const cleanMetadata = metadata
      .replace(/\u{1F464}|\u{1F4C5}|\u{1F4DD}/gu, "")
      .trim();

    decorations.push({
      range,
      renderOptions: {
        before: {
          contentText: metadata,
          fontStyle: "italic",
        },
      },
      hoverMessage: new vscode.MarkdownString(cleanMetadata),
    });
  }
  console.log("Dec", decorations);
  editor.setDecorations(decorationType, decorations);
}

interface BlameMetadata {
  /**
   * @param author - The author of the commit.
   * @param timestamp - The timestamp of the commit.
   * @param summary - The summary of the commit.
   */
  author: string;
  timestamp: string;
  summary: string;
}

function parseBlameOutput(blameOutput: string): Record<number, string> {
  /**
   * @param blameOutput - The output of the git blame command.
   * @returns {Record<number, string>} - A mapping of line numbers to blame metadata.
   * This function parses the output of the git blame command and returns a mapping of line numbers to blame metadata.
   */
  const lines = blameOutput.split("\n");

  const metadataMap: Record<number, BlameMetadata> = {};
  let currentLineNumber = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!metadataMap[currentLineNumber]) {
      metadataMap[currentLineNumber] = {
        author: "",
        timestamp: "",
        summary: "",
      };
    }
    if (/^[a-f0-9]{40} \d{2} \d{2} \d$/.test(line)) {
      const match = line.match(/^[a-f0-9]{40} \d{2} \d{2} \d$/);
      if (match) {
        const lineNumber = parseInt(match[0].split(" ")[2], 10);
        currentLineNumber = lineNumber;
      }
    } else if (/^author /.test(line)) {
      const author = line.replace(/^author /, "").trim();
      if (metadataMap[currentLineNumber].author == "") {
        metadataMap[currentLineNumber].author = `👤 ${author}`;
      }
    } else if (/^author-time /.test(line)) {
      const timestamp = new Date(
        parseInt(line.replace(/^author-time /, "").trim(), 10) * 1000
      );
      if (!metadataMap[currentLineNumber].timestamp) {
        metadataMap[
          currentLineNumber
        ].timestamp = ` 📅 ${timestamp.toLocaleDateString()}`;
      }
    } else if (/^summary /.test(line)) {
      const summary = line.replace(/^summary /, "").trim();
      if (!metadataMap[currentLineNumber].summary) {
        metadataMap[currentLineNumber].summary = ` 📝 ${summary}`;
      }
    }
  }
  const finalMetadataMap: Record<number, string> = {};
  for (const lineNumber in metadataMap) {
    const metadata = metadataMap[lineNumber];
    finalMetadataMap[
      lineNumber
    ] = `${metadata.author}${metadata.timestamp}${metadata.summary}`;
  }
  return finalMetadataMap;
}
