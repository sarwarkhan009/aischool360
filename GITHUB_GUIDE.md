# 🚀 Comprehensive Guide: Uploading AISchool360 to GitHub

This guide provides step-by-step instructions to initialize a Git repository, connect it to GitHub, and push your code securely.

---

## 📋 Prerequisites
1. **GitHub Account**: If you don't have one, create it at [github.com](https://github.com/).
2. **Git Installed**: Ensure Git is installed on your Windows machine. 
   - [Download Git for Windows](https://git-scm.com/download/win) if missing.

---

## 🛠️ Step 1: Initialize Your Local Repository

Open your terminal (PowerShell or Command Prompt) in the project root (`d:\all\aischool360`) and run:

```bash
# Initialize a new Git repository
git init

# (Optional) Rename the default branch to 'main'
git branch -M main
```

---

## 🔍 Step 2: Verify Your `.gitignore`

Ensure sensitive or unnecessary folders (like `node_modules`, `.firebase`, and `.agent`) are NOT uploaded. 

### How to verify if it's working:
Run these commands in your terminal to confirm files are being properly ignored:

```bash
# 1. Check if a specific folder is ignored (should return a path if ignored)
git check-ignore -v .firebase/
git check-ignore -v node_modules/

# 2. List all ignored files in the project
git status --ignored

# 3. See what would be added (Dry Run)
# This shows files Git *plans* to track. Ignored files won't show up here.
git add . --dry-run
```

Your `.gitignore` currently includes:
```text
node_modules/
dist/
.firebase/
.agent/
*.log
.env*
```

---

## 🏗️ Step 3: Stage and Commit Your Files

Add all your code to the "staging area" and create your first snapshot.

```bash
# Add all files to staging
git add .

# Create your first commit
git commit -m "feat: initial commit - core school management system"
```

---

## 🌐 Step 4: Create a Repository on GitHub

1. Go to [GitHub - New Repository](https://github.com/new).
2. **Repository Name**: `aischool360` (or your preferred name).
3. **Public/Private**: Select **Private** if you want to keep the code confidential.
4. **Initialize**: Do **NOT** check "Initialize this repository with a README" (since we already have local files).
5. Click **Create repository**.

---

## 🔗 Step 5: Connect Local to GitHub

Copy the URL of your new GitHub repository (it looks like `https://github.com/YourUsername/aischool360.git`) and run:

```bash
# Add the remote GitHub URL (Replace with YOUR URL)
git remote add origin https://github.com/YOUR_USERNAME/aischool360.git

# Verify the connection
git remote -v
```

---

## 🚀 Step 6: Push Code to GitHub

Finally, send your local code to the cloud!

```bash
# Push the code to the 'main' branch
git push -u origin main
```

> **Note:** If prompted, a window will pop up asking you to sign in to GitHub to authorize the upload.

---

## ✅ Best Practices
- **Commit Often**: Make small commits with descriptive messages for better version history.
- **Merge Requests**: If working in a team, use branches and Pull Requests.
- **Syncing**: Always `git pull origin main` before starting work if you use multiple computers.

---

### 🆘 Troubleshooting
- **Permission Denied**: Check if you are logged into the correct GitHub account in the terminal.
- **Remote Already Exists**: Use `git remote remove origin` and then try Step 5 again.
- **Large Files**: If you have files larger than 100MB, GitHub will reject them. Use [Git LFS](https://git-lfs.github.com/) or add them to `.gitignore`.

---
*Generated with ❤️ by Antigravity*
