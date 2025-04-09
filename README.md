# CodeAtlas  

CodeAtlas is a Visual Studio Code extension designed to provide insights into Git repositories, analyze commit history, and visualize code changes efficiently. It integrates Git logs, contributor statistics, hotspot analysis, and GitHub issue tracking into the editor.  
---
## Installation  
1. Clone or download this repository: ```git clone https://github.com/Akileshdash/CodeAtlas ```
2. Open the project in VS Code.  
3. Run ```npm install``` to install dependencies.  
4. Compile the code using ```npm run compile``` or ```node esbuild.js```
5. Press (`F5`) to launch the extension in a new VS Code window.  

## Usage  
Once the vscode window is opened, open a git-initialized folder or any other git repo in this extension-installed vscode window. Then, use the shortcuts for the command palette (```Ctrl+Shift+P```) in Windows/Linux or (```Cmd+Shift+P```) in Mac to run the CodeAtlas commands.

## Requirements  
- Git must be installed and accessible from the command line.
- The workspace folder must be Git Initialized
- For GitHub integration, authentication is required.  

## Features  

### Git Log Viewer  
- **Command:** `CodeAtlas: Get Git Log`  
- **Shortcut:** `Ctrl+Shift+G`  
- Fetches and displays the commit history in a timeline format. Shows commit details, including hash, message, author, date, and modified files.
  
![image](https://github.com/user-attachments/assets/c415c57a-656a-4b70-aa14-f0acdbc3d0d5)

---
### Git Visualization  
- **Command:** `CodeAtlas: Visualize Git`  
- **Shortcut:** `Ctrl+Shift+V`  
- Provides a graphical visualization of the repository’s Git history and commit relationships.

![image](https://github.com/user-attachments/assets/f63bb8ca-30b9-4a8d-85dd-44ea032f2d1d)

---

### GitHub Issues Fetcher  
- **Command:** `CodeAtlas: Git Issues`  
- **Shortcut:** `Ctrl+Shift+S`  
- Retrieves open issues from the linked GitHub repository and displays them within VS Code.

![image](https://github.com/user-attachments/assets/bdb11a2a-7623-4968-8278-e2aead784be2)
![image](https://github.com/user-attachments/assets/15d9b8f2-5a24-4119-b21a-2a8f4c120e43)

---

### Project Insights  
- **Command:** `CodeAtlas: Get Enhanced Insights`  
- **Shortcut:** `Ctrl+Shift+E`  
- Analyzes repository data, providing statistics on contributors, languages used, total commits, commit frequency, and repository history.

![image](https://github.com/user-attachments/assets/e3708e56-a9ff-44ab-a9d1-e5e0670f7971)

---
### Hotspot Analysis  
- **Command:** `CodeAtlas: Hotspot Analysis`  
- **Shortcut:** `Ctrl+Shift+A`  
- Identifies frequently changed files in the repository, highlighting potential hotspots that might require attention.

![image](https://github.com/user-attachments/assets/c9103eb2-7a2a-4068-8c3a-47277fb8c124)

---

### Line Analysis 
- **Command:** `CodeAtlas: Line Analysis`
- Run it with a file open 
- Gets the last modified commit data for each line and shows it in a digestible manner by consolidating and showing one decoration for a block of code modified in a single commit.

![image](https://github.com/user-attachments/assets/33109d15-3710-471b-9e6f-4c157ca86089)

---
## Team Members : 
[Akilesh](https://github.com/Akileshdash), [Shivadhashan S](https://github.com/Shiva9361), [Aniket Johri](https://github.com/Error-404-NotFound), [Jaimin Viramgama](https://github.com/i-apex), [Siddhant Chatse](https://github.com/sid1309), [Vineeth](https://github.com/VINEETH1425)
