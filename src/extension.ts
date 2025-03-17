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
          files: string[];
        }[] = [];

        for (const entry of log.all) {
          const commitHash = entry.hash;
          const commitDetails = await git.show([commitHash, "--name-only"]);
          const filesChanged = commitDetails
            .split("\n")
            .slice(5)
            .filter((line) => line.trim() !== "");

          logDetails.push({
            hash: commitHash.substring(0, 7),
            message: entry.message,
            date: entry.date,
            author: entry.author_name,
            files: filesChanged,
          });
        }

        const panel = vscode.window.createWebviewPanel(
          "gitLogView",
          "Git Commit Logs",
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = getWebviewContent(logDetails);

        // const logData = logDetails.join('\n');

        // const logData = log.all.map((entry) =>
        // 	`[${entry.hash.substring(0, 7)}] ${entry.date} - ${entry.message} by ${entry.author_name}`
        // ).join('\n');

        // const logFilePath = path.join(workspacePath, 'git-log.txt');
        // fs.writeFileSync(logFilePath, logData);
        // console.log(logData);

        vscode.window.showInformationMessage(
          "Git Logs saved in the file git-log.txt"
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
  }[]
): string {
  const logsHtml = logDetails
    .map(
      (log) => `
        <div class="timeline-item">
            <div class="timeline-icon"></div>
            <div class="timeline-content">
                <h3>${log.message} <span class="hash">(${log.hash})</span></h3>
                <p>${log.date} by <b>${log.author}</b></p>
                <button class="toggle-btn" onclick="toggleFiles('${
                  log.hash
                }')">Show Files</button>
                <ul id="${log.hash}" class="file-list" style="display: none;">
                    ${log.files.map((file) => `<li>${file}</li>`).join("")}
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
                body { 
                    font-family: Arial, sans-serif; 
                    padding: 20px; 
                    background-color: black;
                }
                .timeline {
                    position: relative;
                    margin: 0 auto;
                    padding: 20px;
                    max-width: 800px;
                }
                .timeline-item {
                    position: relative;
                    margin-bottom: 20px;
                    padding-left: 30px;
                }
                .timeline-item::before {
                    content: '';
                    position: absolute;
                    left: 7px;
                    top: 0;
                    width: 4px;
                    height: 100%;
                    background:rgb(38, 166, 252);
                }
                .timeline-icon {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 15px;
                    height: 15px;
                    background-color: #007acc;
                    border: 3px solid #ffffff;
                    border-radius: 50%;
                    z-index: 1;
                }
                .timeline-content {
                    background:rgb(36, 36, 36);
                    border-radius: 6px;
                    padding: 10px 15px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                .hash { color: #007acc; }
                .file-list { 
                    margin-top: 5px; 
                    padding-left: 20px; 
                    list-style-type: none; 
                    border-left: 2px solid #007acc;
                    margin-left: 10px;
                    padding-left: 10px;
                }
                .toggle-btn {
                    background: #007acc;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    cursor: pointer;
                    border-radius: 4px;
                    margin-top: 5px;
                }
                .toggle-btn:hover { background: #005f99; }
            </style>
        </head>
        <body>
            <h1>Git Commit Timeline</h1>
            <div class="timeline">
                ${logsHtml}
            </div>

            <script>
                function toggleFiles(hash) {
                    const fileList = document.getElementById(hash);
                    fileList.style.display = fileList.style.display === 'none' ? 'block' : 'none';
                }
            </script>
        </body>
        </html>
    `;
}

// This method is called when your extension is deactivated
export function deactivate() {}
