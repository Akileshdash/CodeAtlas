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

  const disposableHotspotAnalysis = vscode.commands.registerCommand(
    "CodeAtlas.hotspotAnalysis",
    async () => {
      const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      if (!workspacePath) {
        vscode.window.showErrorMessage("No workspace is open");
        return;
      }

      const git = simpleGit({ baseDir: workspacePath });

      try {
        const log = await git.log({ '--name-only': null }); // Fetch commits with file changes

        if (!log.all || log.all.length === 0) {
          vscode.window.showErrorMessage("No Git Commits found.");
          return;
        }

        const fileChangeCounts: Record<string, number> = {};

        for (const entry of log.all) {
          const commitHash = entry.hash;

          try {
            const commitDetails = await git.show([commitHash, "--stat"]);

            const filesChanged = commitDetails
              .split("\n")
              .filter((line) => line.includes("|")) // Identify lines with filenames
              .map((line) => line.split("|")[0].trim()); // Extract the file name

            filesChanged.forEach((file) => {
              if (file) {
                fileChangeCounts[file] = (fileChangeCounts[file] || 0) + 1;
              }
            });

          } catch (error) {
            console.error(`Failed to process commit ${commitHash}:`, error);
          }
        }

        if (Object.keys(fileChangeCounts).length === 0) {
          vscode.window.showErrorMessage("No file changes detected.");
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          "hotspotAnalysis",
          "Hotspot Analysis",
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = getHotspotAnalysisHtml(fileChangeCounts);

      } catch (error) {
        vscode.window.showErrorMessage("Failed to analyze hotspots.");
        console.error("Hotspot Analysis Error:", error);
      }
    }
  );

  context.subscriptions.push(disposable, disposable2, disposableHotspotAnalysis);
  // context.subscriptions.push(dispisable2);
}
function getHotspotAnalysisHtml(fileChangeCounts: Record<string, number>): string {
    const sortedFiles = Object.entries(fileChangeCounts).sort((a, b) => b[1] - a[1]);
  
    const labels = sortedFiles.map(([file]) => file);
    const values = sortedFiles.map(([, count]) => count);
  
    const listItems = sortedFiles
      .map(([file, count]) => `<li>${file}: <b>${count} changes</b></li>`)
      .join("");
  
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hotspot Analysis</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body { font-family: Arial, sans-serif; background-color: #121212; color: #ffffff; padding: 20px; }
          h1 { color: #00ffcc; text-align: center; }
          ul { list-style-type: none; padding: 0; margin-top: 20px; }
          li {
            background: #1e1e1e;
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            font-size: 16px;
            transition: background 0.3s;
          }
          li:hover { background: #292929; }
          canvas { max-width: 100%; background: #1e1e1e; padding: 10px; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>🔥 Hotspot Files (Frequent Changes)</h1>
        <canvas id="hotspotChart"></canvas>
        <ul>${listItems}</ul>
        
        <script>
          const ctx = document.getElementById('hotspotChart').getContext('2d');
  
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(0, 255, 204, 0.8)');
          gradient.addColorStop(1, 'rgba(0, 102, 204, 0.6)');
  
          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: ${JSON.stringify(labels)},
              datasets: [{
                label: 'File Change Frequency',
                data: ${JSON.stringify(values)},
                backgroundColor: gradient,
                borderColor: '#00ffcc',
                borderWidth: 3,  // Increased line width
                hoverBackgroundColor: '#ffcc00',  // Change color on hover
                hoverBorderColor: '#ff6600',  // Border color on hover
              }]
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              scales: {
                x: {
                  ticks: { color: '#ffffff' },
                  grid: { color: '#444444' },
                  beginAtZero: true
                },
                y: {
                  ticks: { color: '#ffffff' },
                  grid: { color: '#444444' }
                }
              },
              plugins: {
                legend: { labels: { color: '#ffffff' } }
              },
              elements: {
                bar: {
                  borderWidth: 3,  // Make bars thicker
                  hoverBorderWidth: 5  // Thicker on hover
                }
              }
            }
          });
        </script>
      </body>
      </html>
    `;
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
