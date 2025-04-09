# CodeAtlas  

CodeAtlas is a Visual Studio Code extension designed to provide insights into Git repositories, analyze commit history, and visualize code changes efficiently. It integrates Git logs, contributor statistics, hotspot analysis, and GitHub issue tracking into the editor.  

## Features  

### Hello World  
- **Command:** `CodeAtlas.helloWorld`  
- **Shortcut:** `Ctrl+Shift+H`  
- Displays a simple message in VS Code.  

### Git Log Viewer  
- **Command:** `CodeAtlas.getGitLog`  
- **Shortcut:** `Ctrl+Shift+G`  
- Fetches and displays the commit history in a timeline format. Shows commit details, including hash, message, author, date, and modified files.  

### Git Visualization  
- **Command:** `CodeAtlas.visualizeGit`  
- **Shortcut:** `Ctrl+Shift+V`  
- Provides a graphical visualization of the repository’s Git history and commit relationships.  

### GitHub Issues Fetcher  
- **Command:** `CodeAtlas.getIssues`  
- **Shortcut:** `Ctrl+Shift+S`  
- Retrieves open issues from the linked GitHub repository and displays them within VS Code.  

### Project Insights  
- **Command:** `CodeAtlas.getEnhancedInsights`  
- **Shortcut:** `Ctrl+Shift+E`  
- Analyzes repository data, providing statistics on contributors, languages used, total commits, commit frequency, and repository history.  

### Hotspot Analysis  
- **Command:** `CodeAtlas.hotspotAnalysis`  
- **Shortcut:** `Ctrl+Shift+A`  
- Identifies frequently changed files in the repository, highlighting potential hotspots that might require attention.  

## Installation  
1. Clone or download this repository.  
2. Open the project in VS Code.  
3. Run `npm install` to install dependencies.  
4. Compile the code using `node esbuild.js`.
5.. Start debugging (`F5`) to launch the extension in a new VS Code window.  

## Usage  
Once installed, use the shortcuts or the command palette (`Ctrl+Shift+P`) to execute CodeAtlas commands.  

## Requirements  
- Git must be installed and accessible from the command line.  
- For GitHub integration, authentication may be required.  

## License  
This project is licensed under the MIT License.  
