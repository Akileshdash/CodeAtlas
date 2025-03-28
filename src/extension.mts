// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { simpleGit } from "simple-git";
import * as path from "path";
import { registerIssues } from "./githubAPI.mjs";

type Contributor = {
  count: string;
  name: string;
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log("CodeAtlas is now active!");

  const disposableHelllo = vscode.commands.registerCommand(
    "CodeAtlas.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from CodeAtlas!");
    }
  );

  const disposableVisualize = vscode.commands.registerCommand(
    "CodeAtlas.visualizeGit",
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

        let graphData = [];
        let fileMap = new Map(); // Tracks file nodes

        for (const entry of [...log.all].reverse()) {
          const commitHash = entry.hash;
          const commitDetails = await git.show([commitHash, "--name-only"]);

          // Changed Files
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

          let nodes: { id: string; label: string }[] = [];

          let edges = [];

          // filesChanged.forEach((file) => {
          //   if (!fileMap.has(file)){fileMap.set(file, { id: file, label: file });};
          //   nodes.push(fileMap.get(file));
          // });

          // for (let i = 0; i < filesChanged.length - 1; i++) {
          //     for (let j = i + 1; j < filesChanged.length; j++) {
          //       edges.push({ source: filesChanged[i], target: filesChanged[j] });
          //     }
          //   }

          allFiles.forEach((file) => {
            if (!fileMap.has(file)) {
              fileMap.set(file, { id: file, label: file });
            }
            nodes.push(fileMap.get(file));
          });

          for (let i = 0; i < allFiles.length - 1; i++) {
            for (let j = i + 1; j < allFiles.length; j++) {
              edges.push({ source: allFiles[i], target: allFiles[j] });
            }
          }

          graphData.push({
            commit: commitHash,
            message: entry.message,
            nodes,
            edges,
          });
        }

        const panel = vscode.window.createWebviewPanel(
          "gitGraphView",
          "Git Graph",
          vscode.ViewColumn.One,
          { enableScripts: true }
        );
        panel.webview.html = getWebviewContentVisualize(graphData);

        vscode.window.showInformationMessage("Git Graph visualization ready!");
      } catch (err) {
        vscode.window.showErrorMessage("Failed to fetch Git Data.");
        console.error(err);
      }
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
    disposableVisualize,
    disposableGitLog,
    disposableInsights,
    disposableHotspotAnalysis
  );
  registerIssues(context);
}

function getWebviewContentVisualize(
  graphData: { commit: string; message: string; nodes: any[]; edges: any[] }[]
) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://d3js.org/d3.v6.min.js"></script>
      <style>
        body { background: black; color: white; text-align: center; }
        svg { width: 100%; height: 600px; }
        button { background: #007acc; color: white; border: none; padding: 10px; margin-top: 10px; cursor: pointer; }
      </style>
    </head>
    <body>
      <h2>Git Evolution Graph</h2>
      <svg></svg>
      <br>
      <button id="nextCommit">Next Commit</button>

      <script>
        let graphData = ${JSON.stringify(graphData)};
        let index = 0;
        let svg = d3.select("svg"), width = window.innerWidth, height = 600;
        let simulation = d3.forceSimulation().force("link", d3.forceLink().id(d => d.id).distance(100))
                                          .force("charge", d3.forceManyBody().strength(-300))
                                          .force("center", d3.forceCenter(width / 2, height / 2));

       function updateGraph(commitData) {
        d3.select("svg").selectAll("*").remove();

        let groups = {};
        commitData.nodes.forEach(node => {
            let pathParts = node.id.split("/");
            let groupName = pathParts.slice(0, pathParts.length - 1).join("/"); // Get folder path
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(node);
        });

        let groupKeys = Object.keys(groups);

        // Draw group boundaries
        groupKeys.forEach(groupName => {
            let groupNodes = groups[groupName];
            let x = d3.mean(groupNodes, d => d.x);
            let y = d3.mean(groupNodes, d => d.y);
            svg.append("circle")
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", groupNodes.length * 10)
                .attr("fill", "none")
                .attr("stroke", "white")
                .attr("stroke-dasharray", "5,5");
            
            svg.append("text")
                .attr("x", x)
                .attr("y", y - 20)
                .text(groupName)
                .attr("fill", "white")
                .attr("font-size", "12px")
                .attr("text-anchor", "middle");
        });

        let link = svg.selectAll(".link")
            .data(commitData.edges)
            .enter().append("line")
            .attr("stroke", "#ccc").attr("stroke-width", 1.5);

        let node = svg.selectAll(".node")
            .data(commitData.nodes)
            .enter().append("circle")
            .attr("r", 8).attr("fill", "#007acc");

        let text = svg.selectAll(".text")
            .data(commitData.nodes)
            .enter().append("text")
            .text(d => d.label)
            .attr("fill", "white")
            .attr("font-size", "10px");

        simulation.nodes(commitData.nodes).on("tick", () => {
            node.attr("cx", d => d.x).attr("cy", d => d.y);
            link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            text.attr("x", d => d.x + 12).attr("y", d => d.y);
        });

        simulation.force("link").links(commitData.edges);
        simulation.alpha(1).restart();
    }


        function nextCommit() {
          if (index < graphData.length) {
            updateGraph(graphData[index++]);
          } else {
            alert("No more commits!");
          }
        }

        document.getElementById("nextCommit").addEventListener("click", nextCommit);

        // Show the first commit by default
        nextCommit();
      </script>
    </body>
    </html>`;
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

function getWebviewContentInsights(data: any) {
  const {
    contributors,
    languages,
    commitCount,
    dailyCommits,
    firstCommit,
    latestCommit,
  } = data;

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
