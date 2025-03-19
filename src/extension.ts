// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import simpleGit from "simple-git";
import * as fs from "fs";
import * as path from "path";

type Contributor ={
  count: string;
  name: string;
}



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

//   const disposableInsights = vscode.commands.registerCommand('CodeAtlas.getEnhancedInsights', async () => {
//     vscode.window.showInformationMessage('Fetching project insights...1');
//     const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
//     if (!workspacePath) {
//         vscode.window.showErrorMessage('No workspace is open');
//         return;
//     }

//     const git = simpleGit(workspacePath);

//     try {
//         vscode.window.showInformationMessage('Fetching project insights...2');
//         // Contributors (via git shortlog)
//         const contributorsRaw = await git.raw(['shortlog', '-sne']);
//         const contributors: Contributor[] = contributorsRaw
//           .trim()
//           .split('\n')
//           .map((line): Contributor => {
//               const parts = line.trim().split('\t');
//               return { count: parts[0].trim(), name: parts[1].trim() };
//           });


//         // Language Stats
//         const languages = await git.raw(['ls-files']);
//         const fileExtensions = languages
//             .split('\n')
//             .map(file => path.extname(file))
//             .reduce((acc, ext) => {
//                 acc[ext] = (acc[ext] || 0) + 1;
//                 return acc;
//             }, {} as Record<string, number>);

//         // Commit Frequency
//         const commitStats = await git.raw(['rev-list', '--count', 'HEAD']);
//         const commitDates = await git.raw(['log', '--pretty=format:%cd', '--date=short']);
//         const commitDatesArray = commitDates.split('\n');
//         const dailyCommits = commitDatesArray.reduce((acc, date) => {
//             acc[date] = (acc[date] || 0) + 1;
//             return acc;
//         }, {} as Record<string, number>);

//         // First & Latest Commit
//         const firstCommit = await git.raw(['log', '--reverse', '--pretty=format:%h %cd %s', '--date=short']);
//         const latestCommit = await git.raw(['log', '-1', '--pretty=format:%h %cd %s', '--date=short']);

//         vscode.window.showInformationMessage('Fetching project insights...3');
//         // Webview Panel
//         const panel = vscode.window.createWebviewPanel(
//             'projectInsights',
//             'Project Insights',
//             vscode.ViewColumn.One,
//             { enableScripts: true }
//         );

//         panel.webview.html = getWebviewContent2({
//             contributors,
//             languages: Object.entries(fileExtensions)
//                 .map(([ext, count]) => `${ext.replace('.', '').toUpperCase()}: ${count}`)
//                 .join(', '),
//             commitCount: commitStats.trim(),
//             dailyCommits,
//             firstCommit: firstCommit.split('\n')[0],
//             latestCommit: latestCommit.split('\n')[0],
//         });
//     } catch (err) {
//         vscode.window.showErrorMessage('Failed to fetch project insights.');
//         console.error(err);
//     }
//     vscode.window.showInformationMessage('Fetching project insights...4');
// });
 
const disposableInsights = vscode.commands.registerCommand('CodeAtlas.getEnhancedInsights', async () => {
  vscode.window.showInformationMessage('Fetching project insights...1');
  const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspacePath) {
      vscode.window.showErrorMessage('No workspace is open');
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
      vscode.window.showInformationMessage('Fetching project insights...2');
      const log = await git.log();

      if (!log.all || log.all.length === 0) {
          vscode.window.showErrorMessage('No Git Commits found');
          return;
      }

      log.all.forEach((entry) => {
          const existingContributor = contributors.find((c) => c.name === entry.author_name);
          if (existingContributor) {
              existingContributor.count = String(Number(existingContributor.count) + 1);
          } else {
              contributors.push({ name: entry.author_name, count: '1' });
          }
      });

      vscode.window.showInformationMessage(`✅ Contributors fetched: ${contributors.length}`);
  } catch (err) {
      vscode.window.showErrorMessage('Failed to fetch contributors.');
      console.error('Contributors Error:', err);
  }

  try {
  
    const languageRaw = await git.raw(['ls-files']);
    const fileExtensions = languageRaw
        .split('\n')
        .map(file => path.extname(file).replace('.', '').toUpperCase())
        .filter(ext => ext) 
        .reduce((acc, ext) => {
            acc[ext] = (acc[ext] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

    const totalFiles = Object.values(fileExtensions).reduce((sum, count) => sum + count, 0);

    languages = Object.entries(fileExtensions)
        .filter(([ext]) => !['HEIC', 'JPG', 'PNG', 'JPEG', 'WOFF', 'XLSX'].includes(ext)) 
        .map(([ext, count]) => {
            const percentage = ((count / totalFiles) * 100).toFixed(2);
            return `${ext}: ${count} (${percentage}%)`;
        })
        .sort((a, b) => {
            const percentA = parseFloat(a.match(/\(([\d.]+)%\)/)![1]);
            const percentB = parseFloat(b.match(/\(([\d.]+)%\)/)![1]);
            return percentB - percentA; // Sort by highest percentage
        })
        .join(', ');

      // console.log(languages);
      vscode.window.showInformationMessage(`✅ Languages fetched.`);
  } catch (err) {
      vscode.window.showErrorMessage('Failed to fetch languages.');
      console.error('Languages Error:', err);
  }

  try {
      commitStats = (await git.raw(['rev-list', '--count', 'HEAD'])).trim();
      const commitDates = await git.raw(['log', '--pretty=format:%cd', '--date=short']);
      const commitDatesArray = commitDates.split('\n');
      dailyCommits = commitDatesArray.reduce((acc, date) => {
          acc[date] = (acc[date] || 0) + 1;
          return acc;
      }, {} as Record<string, number>);
      vscode.window.showInformationMessage(`✅ Commit stats fetched.`);
  } catch (err) {
      vscode.window.showErrorMessage('Failed to fetch commit statistics.');
      console.error('Commit Stats Error:', err);
  }

  try {
      firstCommit = (await git.raw(['log', '--reverse', '--pretty=format:%h %cd %s', '--date=short'])).split('\n')[0];
      latestCommit = (await git.raw(['log', '-1', '--pretty=format:%h %cd %s', '--date=short'])).split('\n')[0];
      vscode.window.showInformationMessage(`✅ Commit history fetched.`);
  } catch (err) {
      vscode.window.showErrorMessage('Failed to fetch commit history.');
      console.error('Commit History Error:', err);
  }

  const panel = vscode.window.createWebviewPanel(
      'projectInsights',
      'Project Insights',
      vscode.ViewColumn.One,
      { enableScripts: true }
  );

  panel.webview.html = getWebviewContent2({
      contributors,
      languages,
      commitCount: commitStats,
      dailyCommits,
      firstCommit,
      latestCommit,
  });

  vscode.window.showInformationMessage('Fetching project insights...4');
});



  context.subscriptions.push(disposable, disposable2, disposableInsights);
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

function getWebviewContent2(data: any) {
  const { contributors, languages, commitCount, dailyCommits, firstCommit, latestCommit } = data;

  const contributorsList = contributors
      .map((contrib: Contributor) => `<li>${contrib.name} (${contrib.count} commits)</li>`)
      .join('');

  const dailyCommitsList = Object.entries(dailyCommits)
      .map(([date, count]) => `<li>${date}: ${count} commits</li>`)
      .join('');

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

  console.log('Raw languages data:', languages);

  const languageEntries: string[] = typeof languages === 'string'
      ? languages.split(',').map((entry: string) => entry.trim()).filter(entry => entry.includes(':') && entry.includes('%'))
      : [];

  console.log('Parsed Entries:', languageEntries);

  const languageLabels: string[] = languageEntries.map((entry: string) => entry.split(':')[0].trim());
  const languageData: number[] = languageEntries.map((entry: string) => 
      parseFloat(entry.match(/\((.*?)%\)/)?.[1] || '0')
  );

  console.log('Labels:', languageLabels);
  console.log('Data:', languageData);


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



// This method is called when your extension is deactivated
export function deactivate() {}
