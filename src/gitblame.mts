import * as vscode from "vscode";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";

function findGitRoot(filePath: string): string | null {
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
  let disposable = vscode.commands.registerCommand(
    "CodeAtlas.showGitBlame",
    async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showErrorMessage("No active editor found!");
        return;
      }

      const filePath = editor.document.uri.fsPath;
      const languageId = editor.document.languageId;
      const gitRoot = findGitRoot(filePath);
      const commentSyntax = await getCommentSyntax(languageId);

      if (!gitRoot) {
        vscode.window.showErrorMessage("No Git repository found!");
        return;
      }

      process.chdir(gitRoot);

      exec(`git blame --porcelain "${filePath}"`, (error, stdout, stderr) => {
        if (error) {
          vscode.window.showErrorMessage(`Error running git blame: ${stderr}`);
          return;
        }

        const blameData = formatBlameOutput(
          stdout,
          editor.document.getText(),
          commentSyntax
        );

        const virtualDocumentUri = vscode.Uri.parse("untitled:Git Blame Info");
        vscode.workspace.openTextDocument(virtualDocumentUri).then((doc) => {
          vscode.languages.setTextDocumentLanguage(doc, languageId);

          vscode.window
            .showTextDocument(doc, { preview: false })
            .then((editor) => {
              const edit = new vscode.WorkspaceEdit();
              edit.insert(
                virtualDocumentUri,
                new vscode.Position(0, 0),
                blameData
              );
              return vscode.workspace.applyEdit(edit);
            });
        });
      });
    }
  );

  context.subscriptions.push(disposable);
}

function formatBlameOutput(
  blameOutput: string,
  fileContent: string,
  commentSyntax: { lineComment: string; blockComment?: [string, string] }
): string {
  const lines = fileContent.split("\n");
  const blameLines = blameOutput.split("\n");
  const metadataMap: Record<number, string> = {};

  let currentLineNumber = 0;

  // Parse porcelain output to extract metadata for each line
  for (let i = 0; i < blameLines.length; i++) {
    const line = blameLines[i];

    if (/^\t/.test(line)) {
      // Line content starts with a tab character
      currentLineNumber++;
    } else if (/^author /.test(line)) {
      const author = line.replace(/^author /, "").trim();
      metadataMap[currentLineNumber] = metadataMap[currentLineNumber] || "";
      metadataMap[currentLineNumber] += `Author: ${author}`;
    } else if (/^author-time /.test(line)) {
      const timestamp = new Date(
        parseInt(line.replace(/^author-time /, "").trim(), 10) * 1000
      );
      metadataMap[currentLineNumber] += ` | Date: ${timestamp.toISOString()}`;
    } else if (/^summary /.test(line)) {
      const summary = line.replace(/^summary /, "").trim();
      metadataMap[currentLineNumber] += ` | Commit: ${summary}`;
    }
  }

  // Combine code lines with their corresponding metadata as comments
  return lines
    .map((line, index) => {
      const metadata = metadataMap[index + 1];
      if (!metadata) return line;

      const commentPrefix = commentSyntax.lineComment || "//";
      return `${line.replace("\n", "")}${commentPrefix} ${metadata}`;
    })
    .join("\n");
}

async function getCommentSyntax(languageId: string) {
  const languageMapping: Record<
    string,
    { lineComment: string; blockComment?: [string, string] }
  > = {
    python: { lineComment: "#" },
    plaintext: { lineComment: "#" },
    html: { lineComment: "<!--", blockComment: ["<!--", "-->"] },
  };

  if (languageMapping[languageId]) {
    return languageMapping[languageId];
  }
  return { lineComment: "//" };
}
