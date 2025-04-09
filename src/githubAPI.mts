import * as vscode from "vscode";
import { Octokit } from "@octokit/rest";
import { simpleGit } from "simple-git";

export function registerIssues(context: vscode.ExtensionContext) {
  /**
   * @params {vscode.ExtensionContext} context - The extension context provided by VSCode.
   * @returns {void}
   * @description Registers a command to fetch GitHub issues for the current repository.
   * The command is registered under the name "CodeAtlas.getIssues".
   */
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
        // Updating data as per request
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
        vscode.window.showErrorMessage("Failed to fetch Issues Data.");
        console.error(err);
      }
    }
  );
  context.subscriptions.push(disposableIssues);
}

function getIssuesWebviewContent(issues: any[], hasNextPage: boolean) {
  /**
   * @params {any[]} issues - The list of issues to display.
   * @params {boolean} hasNextPage - Indicates if there are more pages of issues to fetch.
   * @returns {string} - The HTML content for the webview.
   * @description Generates the HTML content for the webview that displays GitHub issues.
   */
  const issuesSerialized = JSON.stringify(issues);
  const issuesMap = new Map();
  issues.forEach((issue) => issuesMap.set(issue.number, issue));

  const issuesHtml = issues
    .map(
      (issue) => `
      <div class="issue" data-issue=${issue.number}>
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
          .issue:hover { background: linear-gradient(to right, #003366, #001f3f); }
          .btn-container { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; }
          button { background: linear-gradient(to bottom, #004e92, #000428); color: white; border: none; padding: 10px 15px; cursor: pointer; border-radius: 6px; font-size: 14px; }
          button:disabled { background: #484f58; cursor: not-allowed; }
        </style>
      </head>
      <body>
        <div id="detailView" style="display: none;">
          <h1 id="issueTitle"></h1>
          <div id="issueDetails"></div>
          <button id="backButton">Back</button>
        </div>
        <div id="listView">
          <h1>GitHub Issues</h1>
          <div id="issuesContainer">
            ${issuesHtml}
          </div>
          <div class="btn-container">
            <button id="loadPrev" disabled>Previous</button>
            <button id="loadNext" ${hasNextPage ? "" : "disabled"}>Next</button>
          </div>
        </div>
        
        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            let currentPage = 1;
            let issuesMap = new Map();
            let issues_c = ${issuesSerialized};
            issues_c.forEach(issue => issuesMap.set(issue.number, JSON.stringify(issue)));
            console.log('Issues map:', issuesMap);

            function showIssueDetails(issue) {
              document.getElementById('listView').style.display = 'none';
              document.getElementById('detailView').style.display = 'block';
              document.getElementById('issueTitle').innerHTML = '<h3>#' + issue.number + ':' + issue.title+'</h3>';
              document.getElementById('issueDetails').innerHTML = 
                  '<p><strong>State: </strong>'+ issue.state +'</p>' +
                  '<p><strong>Created by: </strong>' + issue.user.login +'</p>' +
                  '<p><strong>Created at: </strong>' + new Date(issue.created_at).toLocaleString() + '</p>' +
                  '<p>' + issue.body + '</p>';
            }

            function attachIssueListeners() {
              const issueElements = document.querySelectorAll('.issue');
              console.log('Issue elements:', issueElements);
              issueElements.forEach((issueElement) => {
                  issueElement.addEventListener('click', () => {
                      const issueNumber = Number(issueElement.dataset.issue);
                      console.log('Issue number:', issueNumber);
                      const issue = issuesMap.get(issueNumber);
                      const issueData = JSON.parse(issue);
                      showIssueDetails(issueData);
                  });
              });
            }
            attachIssueListeners();
  
            document.getElementById("loadNext").addEventListener("click", () => {
              vscode.postMessage({ command: "fetch", page: currentPage + 1 });
            });
  
            document.getElementById("loadPrev").addEventListener("click", () => {
              vscode.postMessage({ command: "fetch", page: currentPage - 1 });
            });

            document.getElementById("backButton").addEventListener("click", () => {
              document.getElementById('detailView').style.display = 'none';
              document.getElementById('listView').style.display = 'block';
            });
  
            window.addEventListener('message', event => {
              const message = event.data;
              switch (message.command) {
                case 'updateIssues':
                  const issuesContainer = document.getElementById('issuesContainer');
                  issuesContainer.innerHTML = '';
                  message.issues.forEach(issue => {
                    const issueElement = document.createElement('div');
                    issueElement.dataset.issue = issue.number;
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
                  issuesMap.clear();
                  message.issues.forEach(issue => issuesMap.set(issue.number, JSON.stringify(issue)));
                  attachIssueListeners();
                  break;
              }
            });
          })();
        </script>
      </body>
      </html>
    `;
}
