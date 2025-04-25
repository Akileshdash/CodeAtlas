import * as vscode from "vscode";
import { simpleGit } from "simple-git";
import * as path from "path";
import { registerIssues } from "./githubAPI.mjs";
import { registerGitBlame } from "./gitblame.mjs";
import { registerVisualize } from "./visualize.mjs";

type Contributor = {
  /**
   * @params {string} count - The number of commits made by the contributor.
   * @description This property stores the count of commits made by the contributor.
   */
  count: string;
  name: string;
};

export function activate(context: vscode.ExtensionContext) {
  /**
   * @params {vscode.ExtensionContext} context - The extension context provided by VSCode.
   * @returns {void}
   * @description This function is called when the extension is activated.
   * It registers several commands for the extension, including:
   * - "CodeAtlas.helloWorld": Displays a hello world message.
   * - "CodeAtlas.getGitLog": Fetches and displays Git commit logs in a webview.
   * - "CodeAtlas.getEnhancedInsights": Fetches and displays project insights in a webview.
   * - "CodeAtlas.hotspotAnalysis": Analyzes and displays file change hotspots in a webview.
   * - "CodeAtlas.getIssues": Fetches and displays GitHub issues in a webview.
   * - "CodeAtlas.visualize": Visualizes the project structure in a webview.
   */
  console.log("CodeAtlas is now active!");

  const disposableHelllo = vscode.commands.registerCommand(
    "CodeAtlas.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from CodeAtlas!");
    }
  );

  const disposableGitLog = vscode.commands.registerCommand(
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

        panel.webview.html = getWebviewContentGitLog(logDetails);

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

  const disposableInsights = vscode.commands.registerCommand(
    "CodeAtlas.getEnhancedInsights",
    async () => {
      vscode.window.showInformationMessage("Fetching project insights...1");
      const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      if (!workspacePath) {
        vscode.window.showErrorMessage("No workspace is open");
        return;
      }

      const git = simpleGit(workspacePath);
      const contributors: Contributor[] = [];
      let languages = "";
      let commitStats = "0";
      let dailyCommits: Record<string, number> = {};
      let firstCommit = "";
      let latestCommit = "";

      try {
        vscode.window.showInformationMessage("Fetching project insights...2");
        const log = await git.log();

        if (!log.all || log.all.length === 0) {
          vscode.window.showErrorMessage("No Git Commits found");
          return;
        }

        log.all.forEach((entry) => {
          const existingContributor = contributors.find(
            (c) => c.name === entry.author_name
          );
          if (existingContributor) {
            existingContributor.count = String(
              Number(existingContributor.count) + 1
            );
          } else {
            contributors.push({ name: entry.author_name, count: "1" });
          }
        });

        vscode.window.showInformationMessage(
          `✅ Contributors fetched: ${contributors.length}`
        );
      } catch (err) {
        vscode.window.showErrorMessage("Failed to fetch contributors.");
        console.error("Contributors Error:", err);
      }

      try {
        const languageRaw = await git.raw(["ls-files"]);
        const fileExtensions = languageRaw
          .split("\n")
          .map((file) => path.extname(file).replace(".", "").toUpperCase())
          .filter((ext) => ext)
          .reduce((acc, ext) => {
            acc[ext] = (acc[ext] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

        const totalFiles = Object.values(fileExtensions).reduce(
          (sum, count) => sum + count,
          0
        );

        languages = Object.entries(fileExtensions)
          .filter(
            ([ext]) =>
              !["HEIC", "JPG", "PNG", "JPEG", "WOFF", "XLSX"].includes(ext)
          )
          .map(([ext, count]) => {
            const percentage = ((count / totalFiles) * 100).toFixed(2);
            return `${ext}: ${count} (${percentage}%)`;
          })
          .sort((a, b) => {
            const percentA = parseFloat(a.match(/\(([\d.]+)%\)/)![1]);
            const percentB = parseFloat(b.match(/\(([\d.]+)%\)/)![1]);
            return percentB - percentA; // Sort by highest percentage
          })
          .join(", ");

        // console.log(languages);
        vscode.window.showInformationMessage(`✅ Languages fetched.`);
      } catch (err) {
        vscode.window.showErrorMessage("Failed to fetch languages.");
        console.error("Languages Error:", err);
      }

      try {
        commitStats = (await git.raw(["rev-list", "--count", "HEAD"])).trim();
        const commitDates = await git.raw([
          "log",
          "--pretty=format:%cd",
          "--date=short",
        ]);
        const commitDatesArray = commitDates.split("\n");
        dailyCommits = commitDatesArray.reduce((acc, date) => {
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        vscode.window.showInformationMessage(`✅ Commit stats fetched.`);
      } catch (err) {
        vscode.window.showErrorMessage("Failed to fetch commit statistics.");
        console.error("Commit Stats Error:", err);
      }

      try {
        firstCommit = (
          await git.raw([
            "log",
            "--reverse",
            "--pretty=format:%h %cd %s",
            "--date=short",
          ])
        ).split("\n")[0];
        latestCommit = (
          await git.raw([
            "log",
            "-1",
            "--pretty=format:%h %cd %s",
            "--date=short",
          ])
        ).split("\n")[0];
        vscode.window.showInformationMessage(`✅ Commit history fetched.`);
      } catch (err) {
        vscode.window.showErrorMessage("Failed to fetch commit history.");
        console.error("Commit History Error:", err);
      }

      const panel = vscode.window.createWebviewPanel(
        "projectInsights",
        "Project Insights",
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      panel.webview.html = getWebviewContentInsights({
        contributors,
        languages,
        commitCount: commitStats,
        dailyCommits,
        firstCommit,
        latestCommit,
      });

      vscode.window.showInformationMessage("Fetching project insights...4");
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
        const log = await git.log({ "--name-only": null }); // Fetch commits with file changes

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

        panel.webview.html = getWebviewContentHotspot(fileChangeCounts);
      } catch (error) {
        vscode.window.showErrorMessage("Failed to analyze hotspots.");
        console.error("Hotspot Analysis Error:", error);
      }
    }
  );

  context.subscriptions.push(
    disposableHelllo,
    disposableGitLog,
    disposableInsights,
    disposableHotspotAnalysis
  );
  registerIssues(context);
  registerGitBlame(context);
  registerVisualize(context);
}

function getWebviewContentGitLog(
  logDetails: {
    hash: string;
    message: string;
    date: string;
    author: string;
    files: string[];
  }[]
): string {
  const logsData = JSON.stringify(logDetails);
  const numCommits = logDetails.length;

  // Generate dot markers on the slider
  const tickDots = logDetails
    .map(
      (_log, i) => `
        <div class="dot-marker" style="left: ${(i / (numCommits - 1)) * 100}%"></div>
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
          background-color: #121212;
          color: #f0f0f0;
        }

        h1 {
          color: #00bcd4;
        }

        .slider-container {
          margin-top: 40px;
          position: relative;
          height: 60px;
        }

        .range-wrapper {
          position: relative;
          height: 20px;
        }

        input[type="range"] {
          width: 100%;
          margin: 1;
          background: transparent;
          z-index: 2;
          position: absolute;
        }

        .slider-track {
          position: absolute;
          top: 10px;
          left: 0;
          margin-left: 2;
          height: 6px;
          width: 100%;
          background: #444;
          border-radius: 2px;
          z-index: 1;
        }

        .dot-marker {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 10px;
          height: 10px;
          background-color: #00bcd4;
          border-radius: 50%;
          z-index: 3;
        }

        .commit-display {
          background: #1e1e1e;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
          margin-top: 30px;
        }

        .hash {
          color: #00bcd4;
        }

        .file-list {
          list-style: none;
          padding-left: 20px;
          margin-top: 10px;
          border-left: 2px solid #00bcd4;
        }

        .file-list li {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <h1>Git Commit Timeline</h1>

      <div class="slider-container">
        <div class="range-wrapper">
          <div class="slider-track"></div>
          ${tickDots}
          <input type="range" id="commitRange" min="0" max="${numCommits - 1}" value="0" step="1" />
        </div>
        <p>Showing commit <span id="commitIndex">1</span> of ${numCommits}</p>
      </div>

      <div class="commit-display" id="commitDetails">
        <!-- Commit details will appear here -->
      </div>

      <script>
        const logs = ${logsData};
        const range = document.getElementById("commitRange");
        const commitIndex = document.getElementById("commitIndex");
        const commitDetails = document.getElementById("commitDetails");

        function updateCommitDisplay(index) {
          const log = logs[index];
          commitIndex.textContent = parseInt(index) + 1;

          const fileList = log.files.map(file => \`<li>\${file}</li>\`).join("");

          commitDetails.innerHTML = \`
            <h2>\${log.message} <span class="hash">(\${log.hash})</span></h2>
            <p><b>\${log.author}</b> — \${log.date}</p>
            <h4>Files Changed:</h4>
            <ul class="file-list">\${fileList}</ul>
          \`;
        }

        range.addEventListener("input", (e) => {
          updateCommitDisplay(e.target.value);
        });

        // Initialize
        updateCommitDisplay(0);
      </script>
    </body>
    </html>
  `;
}

function getWebviewContentInsights(data: any) {
  const {
    contributors,
    languages,
    commitCount,
    dailyCommits,
    firstCommit,
    latestCommit,
  } = data;
  /**
   * @params {Object} data - The data object containing project insights.
   * @returns {string} - The HTML content for the webview displaying project insights.
   * @description This function generates the HTML content for the webview that displays project insights.
   */
  const contributorsList = contributors
    .map(
      (contrib: Contributor) =>
        `<li>${contrib.name} (${contrib.count} commits)</li>`
    )
    .join("");

  const dailyCommitsList = Object.entries(dailyCommits)
    .map(([date, count]) => `<li>${date}: ${count} commits</li>`)
    .join("");

  console.log(typeof languages);
  // const languageEntries = typeof languages === 'string'
  // ? languages.split(',').map(entry => entry.trim())
  // : [];

  // const languageLabels = languageEntries.map(entry => entry.split(':')[0].trim());
  // const languageData = languageEntries.map(entry =>
  //     parseFloat(entry.match(/\((.*?)%\)/)?.[1] || '0')
  // );
  // const languageLabels = Object.entries(languages).map(([key]) => key.split(':')[0].trim());
  // const languageData = Object.entries(languages).map(([key]) => parseFloat(key.match(/\((.*?)%\)/)?.[1] || '0'));

  console.log("Raw languages data:", languages);

  const languageEntries: string[] =
    typeof languages === "string"
      ? languages
          .split(",")
          .map((entry: string) => entry.trim())
          .filter((entry) => entry.includes(":") && entry.includes("%"))
      : [];

  console.log("Parsed Entries:", languageEntries);

  const languageLabels: string[] = languageEntries.map((entry: string) =>
    entry.split(":")[0].trim()
  );
  const languageData: number[] = languageEntries.map((entry: string) =>
    parseFloat(entry.match(/\((.*?)%\)/)?.[1] || "0")
  );

  console.log("Labels:", languageLabels);
  console.log("Data:", languageData);

  return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <title>Project Insights</title>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <style>
              body { font-family: Arial, sans-serif; padding: 15px; background: #121212; color: #ffffff; }
              h1 { color: #4CAF50; }
              .insights { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
              .box { background: #222222; padding: 15px; border-radius: 8px; }
              ul { list-style-type: none; padding: 0; }
              canvas { max-width: 100%; height: auto; }
          </style>
      </head>
      <body>
          <h1>🚀 Project Insights</h1>  
          <div class="insights">
              <div class="box">
                  <h2>🧑‍🤝‍🧑 Contributors</h2>
                  <ul>${contributorsList}</ul>
              </div>
              <div class="box">
                  <h2>🗂️ Languages Used</h2>
                  <canvas id="languagesChart"></canvas>
              </div>
              <div class="box">
                  <h2>📈 Commit Stats</h2>
                  <p><b>Total Commits:</b> ${commitCount}</p>
                  <h3>📅 Daily Commit Frequency</h3>
                  <ul>${dailyCommitsList}</ul>
              </div>
              <div class="box">
                  <h2>📜 Commit History</h2>
                  <p><b>First Commit:</b> ${firstCommit}</p>
                  <p><b>Latest Commit:</b> ${latestCommit}</p>
              </div>
          </div>

          <script>
              const ctx = document.getElementById('languagesChart').getContext('2d');
              new Chart(ctx, {
                  type: 'doughnut',
                  data: {
                      labels: ${JSON.stringify(languageLabels)},
                      datasets: [{
                          label: 'Percentage',
                          data: ${JSON.stringify(languageData)},
                          backgroundColor: [
                              '#4CAF50', '#FFC107', '#03A9F4', '#E91E63', '#9C27B0', '#FF5722', '#673AB7', '#00BCD4', '#8BC34A', '#FF9800'
                          ],
                      }]
                  },
                  options: {
                      plugins: {
                          legend: {
                              position: 'bottom',
                              labels: { color: '#ffffff' }
                          }
                      }
                  }
              });
          </script>
      </body>
      </html>
  `;
}

function getWebviewContentHotspot(
  fileChangeCounts: Record<string, number>
): string {
  /**
   * @params {Object} fileChangeCounts - An object containing file names and their respective change counts.
   * @returns {string} - The HTML content for the webview displaying hotspot analysis.
   * @description This function generates the HTML content for the webview that displays hotspot analysis.
   */
  const sortedFiles = Object.entries(fileChangeCounts).sort(
    (a, b) => b[1] - a[1]
  );

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

export function deactivate() {}
