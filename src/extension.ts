import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Function to execute shell commands
function runCommand(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error.message);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

// Check if Git is initialized
async function checkGitRepository(folderPath: string): Promise<boolean> {
    return fs.existsSync(path.join(folderPath, '.git'));
}

// Extract Git Information
async function getGitInfo(folderPath: string): Promise<{ [key: string]: string | string[] }> {
    const info: { [key: string]: string | string[] } = {};

    try {
        info['Branch'] = await runCommand('git branch --show-current', folderPath);
        info['Remote'] = await runCommand('git remote -v', folderPath);
        
        // Get all commits
        const commits = await runCommand('git log --all --pretty=format:"%h - %s (%ci)"', folderPath);
        info['Commits'] = commits.split('\n'); // Convert string to array

    } catch (error) {
        vscode.window.showErrorMessage(`Error fetching Git info: ${error}`);
    }

    return info;
}

// Main Activation Function
export async function activate(context: vscode.ExtensionContext) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showWarningMessage('No folder opened.');
        return;
    }

    const folderPath = folder.uri.fsPath;
    vscode.window.showInformationMessage(`Checking Git status for: ${folderPath}`);

    if (await checkGitRepository(folderPath)) {
        vscode.window.showInformationMessage('Git repository found! Fetching details...');
        const gitInfo = await getGitInfo(folderPath);
        console.log('Git Information:', gitInfo);

        const logPath = path.join(folderPath, 'git_commits.log');
        fs.writeFileSync(logPath, JSON.stringify(gitInfo, null, 2));
        vscode.window.showInformationMessage(`Git commits saved to: ${logPath}`);
        vscode.window.createTerminal();
    } else {
        vscode.window.showWarningMessage('No Git repository found in this folder.');
    }
}

// Cleanup on Deactivation
export function deactivate() {}

