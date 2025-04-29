import * as vscode from "vscode";
import {
  DefaultLogFields,
  ListLogLine,
  SimpleGit,
  simpleGit,
} from "simple-git";

export function registerVisualize(context: vscode.ExtensionContext) {
  /**
   * @params {vscode.ExtensionContext} context - The extension context provided by VSCode.
   * @returns {void}
   * @description Registers a command to visualize Git history as a graph.
   * The command is registered under the name "CodeAtlas.visualizeGit".
   */
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

        panel.webview.html = getWebviewContentVisualize(
          [firstCommitData],
          log.all.length - 1,
          logDetails
        );

        panel.webview.onDidReceiveMessage(async (message) => {
          if (message.command === "fetch") {
            const nextCommitIndex = message.index;
            console.log("Next Commit Index:", nextCommitIndex);
            vscode.window.showInformationMessage("Processing Next Commit...");
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
  /**
   * @param git - The SimpleGit instance for executing Git commands.
   * @param commit - The commit object containing commit details.
   * @param commitMap - A map to store commit hashes and their corresponding indices.
   * @param index - The index of the commit in the log.
   * @returns {Promise<{ commit: string; date: string; author: string; message: string; filesChanged: string[]; nodes: { id: string; label: string; lastModified: Number }[] }>} - A promise that resolves to an object containing commit details and file changes.
   * @description This function fetches the commit data, including the commit hash, date, author, message, files changed, and nodes representing the files in the commit.
   */
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
  }[],
  totalCommits: Number,
  logDetails: {
    hash: string;
    message: string;
    date: string;
    author: string;
    files: string[];
  }[]
) {
  /**
   * @param graphData - An array of objects containing commit data.
   * @returns {string} - The HTML content for the webview.
   * @description This function generates the HTML content for the webview, including the D3.js graph and buttons for navigation.
   */


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
        <script src="https://d3js.org/d3.v6.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body { background: #121212; color: white; text-align: center; font-family: Arial, sans-serif; padding: 20px; color: #f0f0f0;}
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
          svg { width: 100%; height: 600px; border: 1px solid white; }
          button { background: #007acc; color: white; border: none; padding: 10px; margin: 5px; cursor: pointer; }
          text { pointer-events: none; }
          canvas { max-width: 100%; background: #1e1e1e; padding: 10px; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h2>Git Visualtion</h2>
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



        <div class="slider-container">
          <div class="range-wrapper">
            <div class="slider-track"></div>
            ${tickDots}
            <input type="range" id="commitRange" min="0" max="${numCommits - 1}" value="0" step="1" />
          </div>
          <p>Showing commit <span id="commitIndex">1</span> of ${numCommits}</p>
        </div>


        <h2>Hotspot Files (Frequent Changes)</h2>
        <canvas id="hotspotChart"></canvas>

        

        <div class="commit-display" id="commitDetails">
          <!-- Commit details will appear here -->
        </div>








        <script>
          let graphData = ${JSON.stringify(graphData)};
          let totalCommits = ${totalCommits};
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
                document.getElementById("nextCommit").disabled = false;
                document.getElementById("previousCommit").disabled = false;
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
                g.selectAll("*").remove();
                g.append("text").text("Processing Next Commit...")
                .attr("fill", "white").attr("font-size", "20px")
                .attr("x", width / 2).attr("y", height / 2)
                .attr("text-anchor", "middle").style("opacity", 0.5)
                .attr("dominant-baseline", "middle");
                document.getElementById("nextCommit").disabled = true;
                document.getElementById("previousCommit").disabled = true;
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

          updateGraph(0); 


          let previousIndex = 0;



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

          range.addEventListener("input", (e) => {
              const newIndex = parseInt(e.target.value);


              const direction = newIndex > previousIndex ? "right" : "left";
              
              // Update previousIndex for next input
              previousIndex = newIndex;
              
              index = newIndex;

              if(direction === "right") {
              
                if (index < graphData.length - 1) {
                  index++;
                  updateGraph(graphData[index]);
                } else {
                    g.selectAll("*").remove();
                    g.append("text").text("Processing Next Commit...")
                    .attr("fill", "white").attr("font-size", "20px")
                    .attr("x", width / 2).attr("y", height / 2)
                    .attr("text-anchor", "middle").style("opacity", 0.5)
                    .attr("dominant-baseline", "middle");
                    vscode.postMessage({ command: "fetch", index: graphData.length });
                }
              
              }

              if(direction === "left") {
          
                if (index >= 0) {
                  index--;
                  updateGraph(graphData[index]);
                }
              
              }
              


              updateCommitDisplay(index);
              
              updateHotspotChart(index);
              

          });


          // Initialize
          updateCommitDisplay(0);

        </script>
      </body>
      </html>`;
}
