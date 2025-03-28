import * as vscode from "vscode";
import { Octokit } from "@octokit/rest";
import { simpleGit } from "simple-git";

export function registerIssues(context: vscode.ExtensionContext) {
  const disposableIssues = vscode.commands.registerCommand(
    "CodeAtlas.getIssues",
    async () => {
      const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      const session = vscode.authentication.getSession("github", ["repo"], {
        createIfNone: true,
      });
      if (!session) {
        vscode.window.showErrorMessage("Github login required");
        return;
      }
      if (!workspacePath) {
        vscode.window.showErrorMessage("No workspace is open");
        return;
      }
      try {
        const git = simpleGit({ baseDir: workspacePath });
        // Get Remote address
        const remote = await git.listRemote(["--get-url"]);
        const name_repo = remote
          .replace("https://github.com/", "")
          .replace(".git", "");

        const owner_string = name_repo.split("/")[0];
        const repo_string = name_repo.split("/")[1].trim();

        vscode.window.showInformationMessage(name_repo);
        const octokit = new Octokit({
          auth: (await session).accessToken,
        });
        const initialResponse = await octokit.rest.issues.listForRepo({
          owner: owner_string,
          repo: repo_string,
          per_page: 100,
          page: 1,
          state: "all",
        });

        const panel = vscode.window.createWebviewPanel(
          "gitGraphView",
          "Git Issues",
          vscode.ViewColumn.One,
          { enableScripts: true }
        );
        panel.webview.onDidReceiveMessage((message) => {
          switch (message.command) {
            case "fetch": {
              const page = message.page;
              octokit.rest.issues
                .listForRepo({
                  owner: owner_string,
                  repo: repo_string,
                  per_page: 100,
                  page: page,
                })
                .then((response) => {
                  panel.webview.postMessage({
                    command: "updateIssues",
                    issues: response.data,
                    hasNextPage: response.headers.link
                      ? response.headers.link.includes('rel="next"')
                      : false,
                    currentPage: page,
                  });
                });
              break;
            }
          }
        });
        const hasNextPage = initialResponse.headers.link
          ? initialResponse.headers.link.includes('rel="next"')
          : false;

        panel.webview.html = getIssuesWebviewContent(
          initialResponse.data,
          hasNextPage
        );
      } catch (err) {
        vscode.window.showErrorMessage("Failed to fetch Issues.");
        console.error(err);
      }
    }
  );
  context.subscriptions.push(disposableIssues);
}

function getIssuesWebviewContent(issues: any[], hasNextPage: boolean) {
  const issuesHtml = issues
    .map(
      (issue) => `
      <div class="issue">
        <h3>#${issue.number}: ${issue.title}</h3>
        <p>State: ${issue.state}</p>
        <p>Created by: ${issue.user.login}</p>
        <p>Created at: ${new Date(issue.created_at).toLocaleString()}</p>
      </div>
    `
    )
    .join("");

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: linear-gradient(to right, #000428, #004e92); color: #c9d1d9; }
          .issue { background: linear-gradient(to right, #001f3f, #003366); border-radius: 6px; padding: 15px; margin-bottom: 10px; }
          h3 { color: #58a6ff; }
          .btn-container { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; }
          button { background: linear-gradient(to right, #004e92, #000428); color: white; border: none; padding: 10px 15px; cursor: pointer; border-radius: 6px; font-size: 14px; }
          button:disabled { background: #484f58; cursor: not-allowed; }
        </style>
      </head>
      <body>
        <h1>GitHub Issues</h1>
        <div id="issuesContainer">
          ${issuesHtml}
        </div>
        <div class="btn-container">
          <button id="loadPrev" disabled>Previous</button>
          <button id="loadNext" ${hasNextPage ? "" : "disabled"}>Next</button>
        </div>
  
        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            let currentPage = 1;
  
            document.getElementById("loadNext").addEventListener("click", () => {
              vscode.postMessage({ command: "fetch", page: currentPage + 1 });
            });
  
            document.getElementById("loadPrev").addEventListener("click", () => {
              vscode.postMessage({ command: "fetch", page: currentPage - 1 });
            });
  
            window.addEventListener('message', event => {
              const message = event.data;
              switch (message.command) {
                case 'updateIssues':
                  const issuesContainer = document.getElementById('issuesContainer');
                  issuesContainer.innerHTML = '';
                  message.issues.forEach(issue => {
                    const issueElement = document.createElement('div');
                    issueElement.className = 'issue';
                    issueElement.innerHTML = 
                        '<h3>#' + issue.number + ': ' + issue.title + '</h3>' +
                        '<p>State: ' + issue.state + '</p>' +
                        '<p>Created by: ' + issue.user.login + '</p>' +
                        '<p>Created at: ' + new Date(issue.created_at).toLocaleString() + '</p>';
                    issuesContainer.appendChild(issueElement);
                  });
                  document.getElementById("loadNext").disabled = !message.hasNextPage;
                  document.getElementById("loadPrev").disabled = message.currentPage === 1;
                  currentPage = message.currentPage;
                  break;
              }
            });
          })();
        </script>
      </body>
      </html>
    `;
}
