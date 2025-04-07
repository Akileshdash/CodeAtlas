import * as vscode from "vscode";
import {
  DefaultLogFields,
  ListLogLine,
  SimpleGit,
  simpleGit,
} from "simple-git";

export function registerVisualize(context: vscode.ExtensionContext) {
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

        const firstCommit = log.all[log.all.length - 1];
        const CommitMap = new Map<string, Number>();
        const firstCommitData = await fetchCommitData(
          git,
          firstCommit,
          CommitMap
        );
        CommitMap.set(firstCommit.hash, 0);

        const panel = vscode.window.createWebviewPanel(
          "gitGraphView",
          "Git Graph",
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = getWebviewContentVisualize([firstCommitData]);

        panel.webview.onDidReceiveMessage(async (message) => {
          if (message.command === "fetch") {
            const nextCommitIndex = message.index;
            console.log("Next Commit Index:", nextCommitIndex);
            if (nextCommitIndex < log.all.length) {
              const nextCommit = log.all[log.all.length - 1 - nextCommitIndex];
              if (!CommitMap.has(nextCommit.hash)) {
                CommitMap.set(nextCommit.hash, nextCommitIndex);
              }
              const nextCommitData = await fetchCommitData(
                git,
                nextCommit,
                CommitMap
              );
              panel.webview.postMessage({
                command: "updateGraph",
                data: nextCommitData,
              });
            }
          }
        });

        vscode.window.showInformationMessage("Git Graph visualization ready!");
      } catch (err) {
        vscode.window.showErrorMessage("Failed to fetch Git Data.");
        console.error(err);
      }
    }
  );
  context.subscriptions.push(disposableVisualize);
}

async function fetchCommitData(
  git: SimpleGit,
  commit: DefaultLogFields & ListLogLine,
  commitMap: Map<string, Number>,
  index: number = 0
) {
  const commitHash = commit.hash;
  const commitDetails = await git.show([commitHash, "--name-only"]);

  const filesChanged = commitDetails
    .split("\n")
    .slice(5)
    .filter((line: string) => line.trim() !== "");

  const allFilesOutput = await git.raw([
    "ls-tree",
    "-r",
    "--name-only",
    commitHash,
  ]);
  const allFiles = allFilesOutput
    .split("\n")
    .map((file: string) => file.trim())
    .filter((file: string) => file !== "");

  let nodes: { id: string; label: string; lastModified: Number }[] = [];
  for (const file of allFiles) {
    let node = { id: file, label: file, lastModified: 0 };
    try {
      const output = await git.raw([
        "log",
        "-1",
        `${commitHash}`,
        "--",
        `${file}`,
      ]);
      const lastCommit = output.split("\n")[0].split(" ")[1].trim();
      node.lastModified = Number(commitMap.get(lastCommit) || index);
    } catch (error) {
      console.error(`Error fetching last modified commit for ${file}:`, error);
    }
    nodes.push(node);
  }

  return {
    commit: commit.hash,
    date: commit.date,
    author: commit.author_name,
    message: commit.message,
    filesChanged,
    nodes,
  };
}

function getWebviewContentVisualize(
  graphData: {
    commit: string;
    message: string;
    nodes: any[];
    date: string;
    author: string;
    filesChanged: string[];
  }[]
) {
  return `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://d3js.org/d3.v6.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body { background: black; color: white; text-align: center; font-family: Arial; }
          svg { width: 100%; height: 600px; border: 1px solid white; }
          button { background: #007acc; color: white; border: none; padding: 10px; margin: 5px; cursor: pointer; }
          text { pointer-events: none; }
          canvas { max-width: 100%; background: #1e1e1e; padding: 10px; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h2>Git Evolution Graph</h2>
        <div id="commitInfo" style="position: absolute; top: 50px; left: 10px; background: rgba(0, 0, 0, 0.7); padding: 10px; border-radius: 5px; color: white; text-align: left;">
          <strong>Commit:</strong> <span id="commitId"></span><br>
          <strong>Author:</strong> <span id="author"></span><br>
          <strong>Commit Message:</strong> <span id="commitMessage"></span><br>
          <strong>Date:</strong> <span id="commitDate"></span>
        </div>
        <svg></svg>
        <br>
        <button id="zoomIn">Zoom In</button>
        <button id="zoomOut">Zoom Out</button>
        <button id="resetCommit">Reset</button>
        <button id="nextCommit">Next Commit</button>
        <button id="previousCommit">Previous Commit</button>
        <h2>Hotspot Files (Frequent Changes)</h2>
        <canvas id="hotspotChart"></canvas>
  
        <script>
          let graphData = ${JSON.stringify(graphData)};
          const vscode = acquireVsCodeApi();
          let index = 0;
          let width = window.innerWidth, height = 600;
  
          let svg = d3.select("svg")
                      .attr("width", width)
                      .attr("height", height);
  
          let g = svg.append("g"); // Group for zooming
  
          let zoom = d3.zoom()
                       .scaleExtent([0.5, 5]) // Min and max zoom scale
                       .on("zoom", (event) => g.attr("transform", event.transform));
  
          svg.call(zoom); // Enable zoom on SVG

          window.addEventListener("message", (event) => {
                if (event.data.command === "updateGraph") {
                graphData.push(event.data.data);
                index = graphData.length - 1;
                updateGraph(graphData[index]);
                }
          });
  
          function buildHierarchy(nodes) {
            let root = { name: "root", children: [] };
            let map = { "root": root };
  
            nodes.forEach(node => {
              let parts = node.id.split("/");
              let filename = parts.pop();
              let current = root;
  
              parts.forEach(part => {
                if (!map[part]) {
                  let newFolder = { name: part, children: [] };
                  map[part] = newFolder;
                  current.children.push(newFolder);
                }
                current = map[part];
              });
  
              current.children.push({ name: filename, size: 1, type: "file" });
            });
  
            return d3.hierarchy(root).sum(d => d.size);
          }
  
          function updateGraph(commitData) {
            g.selectAll("*").remove();
            
            // Update commit info display
            document.getElementById("commitId").textContent = commitData.commit;
            document.getElementById("commitMessage").textContent = commitData.message;
            document.getElementById("author").textContent = commitData.author;
            document.getElementById("commitDate").textContent = commitData.date;
            let hierarchyData = buildHierarchy(commitData.nodes);
            let pack = d3.pack().size([width - 100, height - 100]).padding(10);
            let root = pack(hierarchyData);
  
            const filesChangedSet = new Set(commitData.filesChanged); // Fast lookup for changed files
            const prevFilesChangedSet = new Set(index > 0 ? graphData[index - 1].filesChanged : []); // Previous commit's files
            const nodesLastModifiedMap = new Map();
            commitData.nodes.forEach(node => {
              nodesLastModifiedMap.set(node.id, node.lastModified);
            });

            console.log(nodesLastModifiedMap);
            let nodes = g.selectAll("circle")
                         .data(root.descendants())
                         .enter().append("circle")
                         .attr("cx", d => d.x)
                         .attr("cy", d => d.y)
                         .attr("r", d => d.r)
                          .attr("fill", d => {
                              if (!d.children) { // Only apply to file nodes
                                  let filePath = d.ancestors()
                                                  .map(a => a.data.name)
                                                  .filter(name => name !== "root") // Fix root issue
                                                  .reverse()  // Fix order
                                                  .join("/");
  
                                  if (filesChangedSet.has(filePath)) {
                                      return prevFilesChangedSet.has(filePath) ? "red" : "green";  // New files in green
                                  }
                                  return "#007acc"; // Default color for unchanged files
                              }
                              return "none"; // Keep folders transparent
                          })
                         .attr("stroke", "white");
  
            // Create labels but keep them hidden initially
            let labels = g.selectAll("text")
                          .data(root.descendants())
                          .enter().append("text")
                          .attr("x", d => d.x)
                          .attr("y", d => d.y - d.r - 5)
                          .text(d => d.data.name)
                          .attr("fill", "white")
                          .attr("font-size", "12px")
                          .attr("text-anchor", "middle")
                          .style("opacity", 0);  // Hide labels initially
  
            // Show label on hover
            nodes.on("mouseover", function(event, d) {
              // Find the corresponding label and show it
              d3.select(this).style("cursor", "pointer");
              labels.filter(l => l.data.name === d.data.name)
                    .transition().duration(200)
                    .style("opacity", 1);  // Fade in the label
            });
  
            
            nodes.on("click", function(event, d) {
              if (!d.children){
                const filePath = d.ancestors()
                  .map(a => a.data.name)
                  .filter(name => name !== "root") 
                  .reverse() 
                  .join("/");
                index = nodesLastModifiedMap.get(filePath);
                updateGraph(graphData[index]);
              }
            });
  
  
            // Hide label on mouseout
            nodes.on("mouseout", function(event, d) {
              // Hide the label when the mouse leaves
              labels.filter(l => l.data.name === d.data.name)
                    .transition().duration(200)
                    .style("opacity", 0);  // Fade out the label
            });
            updateHotspotChart(index);
          }
  
          function nextCommit() {
            if (index < graphData.length - 1) {
                index++;
                updateGraph(graphData[index]);
            } else {
                vscode.postMessage({ command: "fetch", index: graphData.length });
            }
          }
  
          function previousCommit() {
            if (index >= 0) {
              index--;
              updateGraph(graphData[index]);
            }
          }
  
          function zoomIn() {
            svg.transition().call(zoom.scaleBy, 1.2);
          }
  
          function zoomOut() {
            svg.transition().call(zoom.scaleBy, 0.8);
          }
  
          function resetCommit() {
            index=0;
            updateGraph(graphData[index]);
          }
  
          document.getElementById("nextCommit").addEventListener("click", nextCommit);
          document.getElementById("previousCommit").addEventListener("click", previousCommit);
          document.getElementById("zoomIn").addEventListener("click", zoomIn);
          document.getElementById("zoomOut").addEventListener("click", zoomOut);
          document.getElementById("resetCommit").addEventListener("click", resetCommit);
          
          let hotspotChart;
          function updateHotspotChart(commitIndex) {
            const fileChangeCounts = {}; 
            for (let i = 0; i <= commitIndex; i++) {
              graphData[i].filesChanged.forEach(file => {
                fileChangeCounts[file] = (fileChangeCounts[file] || 0) + 1;
              });
            }

            const sortedFiles = Object.entries(fileChangeCounts).sort(([, a], [, b]) => b - a);
            const labels = sortedFiles.map(([file]) => file);
            const values = sortedFiles.map(([, count]) => count);

            const ctx = document.getElementById('hotspotChart').getContext('2d');

            if (hotspotChart) {
              hotspotChart.destroy();
            }

            hotspotChart = new Chart(ctx, {
              type: 'bar',
              data: {
                labels: labels,
                datasets: [{
                  label: 'File Change Frequency',
                  data: values,
                  backgroundColor: 'rgba(0, 255, 204, 0.8)',
                  borderColor: '#00ffcc',
                  borderWidth: 3,
                  hoverBackgroundColor: '#ffcc00',
                  hoverBorderColor: '#ff6600',
                }]
              },
              options: {
                indexAxis: 'y',
                responsive: true,
                scales: {
                  x: { ticks: { color: '#ffffff' }, grid: { color: '#444444' }, beginAtZero: true },
                  y: { ticks: { color: '#ffffff' }, grid: { color: '#444444' } }
                },
                plugins: { legend: { labels: { color: '#ffffff' } } },
                elements: { bar: { borderWidth: 3, hoverBorderWidth: 5 } }
              }
            });
          }

          updateGraph(graphData[index]); 
        </script>
      </body>
      </html>`;
}
