// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import simpleGit from "simple-git";
import * as fs from "fs";
import * as path from "path";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "CodeAtlas" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json

  const disposable = vscode.commands.registerCommand(
    "CodeAtlas.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from CodeAtlas!");
    }
  );

  const disposable2 = vscode.commands.registerCommand(
    "CodeAtlas.getGitLog",
    async () => {
      const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  
      if (!workspacePath) {
        vscode.window.showErrorMessage("No workspace is open");
        return;
      }
  
      const git = simpleGit({ baseDir: workspacePath });
  
      try {
        const log = await git.log();
  
        if (!log.all || log.all.length === 0) {
          vscode.window.showErrorMessage("No Git Commits found");
          return;
        }
  
        const logDetails: {
          hash: string;
          message: string;
          date: string;
          author: string;
          files: string[]; // Changed files
          allFiles: string[]; // All files present in that commit
        }[] = [];
  
        for (const entry of log.all) {
          const commitHash = entry.hash;
  
          // Get changed files
          const commitDetails = await git.show([commitHash, "--name-only"]);
          const filesChanged = commitDetails
            .split("\n")
            .slice(5)
            .filter((line) => line.trim() !== "");
  
          // Get all files at that commit
          const allFilesOutput = await git.raw([
            "ls-tree",
            "-r",
            "--name-only",
            commitHash,
          ]);
          const allFiles = allFilesOutput
            .split("\n")
            .map((file) => file.trim())
            .filter((file) => file !== "");
  
          logDetails.push({
            hash: commitHash.substring(0, 7),
            message: entry.message,
            date: entry.date,
            author: entry.author_name,
            files: filesChanged,
            allFiles: allFiles, // Save all files at that commit
          });
        }
  
        const panel = vscode.window.createWebviewPanel(
          "gitLogView",
          "Git Commit Logs",
          vscode.ViewColumn.One,
          { enableScripts: true }
        );
  
        panel.webview.html = getWebviewContent(logDetails);
  
        vscode.window.showInformationMessage(
          "Git Logs retrieved successfully!"
        );
      } catch (err) {
        vscode.window.showErrorMessage("Failed to fetch Git Logs.");
        console.error(err);
      }
    }
  );

  context.subscriptions.push(disposable, disposable2);
  // context.subscriptions.push(dispisable2);
}

function getWebviewContent(
  logDetails: {
    hash: string;
    message: string;
    date: string;
    author: string;
    files: string[];
    allFiles: string[]; // All files at the commit
  }[]
): string {
  console.log("Commit Log Details:", JSON.stringify(logDetails, null, 2));
  const logsHtml = logDetails
    .map(
      (log) => `
        <div class="timeline-item">
            <div class="timeline-icon"></div>
            <div class="timeline-content">
                <h3>${log.message} <span class="hash">(${log.hash})</span></h3>
                <p>${log.date} by <b>${log.author}</b></p>

                <!-- Show Changed Files Button -->
                <button class="toggle-btn" onclick="toggleFiles('${log.hash}-changed')">Show Changed Files</button>
                <ul id="${log.hash}-changed" class="file-list" style="display: none;">
                    ${log.files.length > 0 ? log.files.map((file) => `<li>${file}</li>`).join("") : "<li>No changed files</li>"}
                </ul>

                <!-- Show All Files Button -->
                <button class="toggle-btn" onclick="toggleFiles('${log.hash}-all')">Show All Files</button>
                <ul id="${log.hash}-all" class="file-list" style="display: none;">
                    ${log.allFiles.length > 0 ? log.allFiles.map((file) => `<li>${file}</li>`).join("") : "<li>No files in this commit</li>"}
                </ul>
            </div>
        </div>
    `
    )
    .join("");

  return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; background-color: black; color: white; }
                .timeline { max-width: 800px; margin: 0 auto; padding: 20px; }
                .timeline-item { margin-bottom: 20px; padding-left: 30px; position: relative; }
                .timeline-content { background:rgb(36, 36, 36); border-radius: 6px; padding: 10px 15px; }
                .hash { color: #007acc; }
                .file-list { margin-top: 5px; padding-left: 20px; list-style-type: none; border-left: 2px solid #007acc; padding-left: 10px; }
                .toggle-btn { background: #007acc; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px; margin-top: 5px; }
                .toggle-btn:hover { background: #005f99; }
            </style>
        </head>
        <body>
            <h1>Git Commit Timeline</h1>
            <div class="timeline">
                ${logsHtml}
            </div>

            <script>
                function toggleFiles(id) {
                    const fileList = document.getElementById(id);
                    fileList.style.display = fileList.style.display === 'none' ? 'block' : 'none';
                }
            </script>
        </body>
        </html>
    `;
}



// This method is called when your extension is deactivated
export function deactivate() {}
