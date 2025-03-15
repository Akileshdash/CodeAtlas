// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import simpleGit from 'simple-git';
import { Project } from 'ts-morph';
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "codeatlas" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	// const disposable = vscode.commands.registerCommand('codeatlas.helloWorld', () => {
	// 	// The code you place here will be executed every time your command is executed
	// 	// Display a message box to the user
	// 	vscode.window.showInformationMessage('Hello World from CodeAtlas!');
	// });

	let disposable = vscode.commands.registerCommand('codeatlas.showGraph', async () => {
        // const folders = vscode.workspace.workspaceFolders;
        // if (!folders) {
        //     vscode.window.showErrorMessage('No workspace folder open.');
        //     return;
        // }
        const panel = vscode.window.createWebviewPanel(
            'codeGraph',
            'CodeAtlas Visualization',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
            panel.webview.html = `<h3>No workspace folder open.</h3>`;
            return;
        }


        const folderUri = folders[0].uri;
        const tree = await getProjectStructure(folderUri.fsPath);
        const commits = await getGitHistory(folderUri.fsPath);
        //vscode.window.showInformationMessage(JSON.stringify(tree, null, 2));
        panel.webview.html = getWebviewContent(tree,commits);
    });

	context.subscriptions.push(disposable);
}

async function getProjectStructure(rootPath: string) {
    const fs = vscode.workspace.fs;
    const rootUri = vscode.Uri.file(rootPath);
    return await scanDirectory(rootUri);
}

async function scanDirectory(uri: vscode.Uri) {
    let structure: any = { name: path.basename(uri.fsPath), type: 'folder', children: [] };
    try {
        const entries = await vscode.workspace.fs.readDirectory(uri);
        for (const [name, type] of entries) {
            const childUri = vscode.Uri.joinPath(uri, name);
            if (type === vscode.FileType.Directory) {
                structure.children.push(await scanDirectory(childUri));
            } else {
                structure.children.push({ name, type: 'file' });
            }
        }
    } catch (err) {
        console.error(err);
    }
    return structure;
}
function getWebviewContent(tree: any, commits: any) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/vis-network/9.1.2/vis-network.min.js"></script>
            <style>
                #mynetwork { width: 100%; height: 500px; border: 1px solid lightgray; }
                #commitInfo { margin-top: 20px; padding: 10px; border: 1px solid black; }
            </style>
        </head>
        <body>
            <div>
                <h3>Project Timeline</h3>
                <input type="range" id="timelineSlider" min="0" max="${commits.length - 1}" step="1" value="0">
                <span id="sliderValue">Latest Commit</span>
            </div>
            <div id="mynetwork"></div>
            <div id="commitInfo">
                <h3>Commit History</h3>
                <ul id="commitList"></ul>
            </div>
            <script>
                var nodes = new vis.DataSet();
                var edges = new vis.DataSet();
                var commits = ${JSON.stringify(commits)};

                function parseTree(node, parentId = null) {
                    let id = Math.random().toString(36).substr(2, 9);
                    nodes.add({ id, label: node.name, shape: node.type === 'folder' ? 'box' : 'ellipse' });

                    if (parentId) edges.add({ from: parentId, to: id });

                    if (node.children) {
                        node.children.forEach(child => parseTree(child, id));
                    }
                }

                parseTree(${JSON.stringify(tree)});

                var container = document.getElementById('mynetwork');
                var data = { nodes: nodes, edges: edges };
                var options = { interaction: { hover: true } };
                var network = new vis.Network(container, data, options);

                // Display commit history
                var commitList = document.getElementById('commitList');
                commits.forEach((commit, index) => {
                    let listItem = document.createElement('li');
                    listItem.textContent = commit.date + " - " + commit.message;
                    commitList.appendChild(listItem);
                });

                // Timeline slider functionality
                document.getElementById("timelineSlider").addEventListener("input", function(event) {
                    let index = event.target.value;
                    document.getElementById("sliderValue").innerText = commits[index].date + " - " + commits[index].message;

                    // TODO: Future step - Update visualization based on commit
                });
            </script>
        </body>
        </html>
    `;
}



async function getGitHistory(rootPath: string) {
    const git = simpleGit(rootPath);
    const logs = await git.log();
    return logs.all.map(log => ({
        message: log.message,
        date: log.date,
        author: log.author_name,
    }));
}

async function getDependencies(rootPath: string) {
    const project = new Project({ tsConfigFilePath: rootPath + "/tsconfig.json" });
    let dependencies: any[] = [];

    project.getSourceFiles().forEach(sourceFile => {
        sourceFile.getImportDeclarations().forEach(importDeclaration => {
            dependencies.push({
                from: sourceFile.getFilePath(),
                to: importDeclaration.getModuleSpecifierValue()
            });
        });
    });

    return dependencies;
}

// This method is called when your extension is deactivated
export function deactivate() {}
