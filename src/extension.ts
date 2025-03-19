// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import simpleGit from "simple-git";
import * as fs from "fs";
import * as path from "path";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('CodeAtlas is now active!');

  const disposable = vscode.commands.registerCommand("CodeAtlas.visualizeGit", async () => {
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
        const filesChanged = commitDetails.split("\n").slice(5).filter((line) => line.trim() !== "");

        // Get all files at that commit
        const allFilesOutput = await git.raw(["ls-tree","-r","--name-only",commitHash,]);
        const allFiles = allFilesOutput.split("\n").map((file) => file.trim()).filter((file) => file !== "");

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
            if (!fileMap.has(file)){fileMap.set(file, { id: file, label: file });};
            nodes.push(fileMap.get(file));
          });

        for (let i = 0; i < allFiles.length - 1; i++) {
          for (let j = i + 1; j < allFiles.length; j++) {
            edges.push({ source: allFiles[i], target: allFiles[j] });
          }
        }

        graphData.push({ commit: commitHash, message: entry.message, nodes, edges });
      }

      const panel = vscode.window.createWebviewPanel("gitGraphView", "Git Graph", vscode.ViewColumn.One, { enableScripts: true });
      panel.webview.html = getWebviewContent(graphData);

      vscode.window.showInformationMessage("Git Graph visualization ready!");
    } catch (err) {
      vscode.window.showErrorMessage("Failed to fetch Git Data.");
      console.error(err);
    }
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(graphData: { commit: string; message: string; nodes: any[]; edges: any[] }[]) {
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


export function deactivate() {}