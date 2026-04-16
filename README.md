# Classroom Occupancy Monitoring and Scheduling System

This project is a starter web-based classroom occupancy monitoring and scheduling system.

It includes:

- a `backend/` folder for the Flask application
- a `frontend/` folder for the HTML, CSS, and JavaScript interface

## Project Structure

- `backend/app.py` - Flask app entry point
- `backend/routes.py` - backend routes
- `backend/models.py` - database models
- `backend/database.py` - database setup
- `frontend/index.html` - main page
- `frontend/styles.css` - page styling
- `frontend/script.js` - frontend behavior
- `requirements.txt` - Python dependencies

## Tech Stack

- Python
- Flask
- SQLite for local development
- PostgreSQL may be used later for deployment

## How to Fork This Repository to Your GitHub Account

If this project is already on GitHub, the easiest way to get your own copy is to fork it.

### 1. Fork the repository

1. Sign in to [GitHub](https://github.com).
2. Open this project repository in your browser.
3. Click the `Fork` button in the top-right corner.
4. Choose your GitHub account as the destination.
5. Click `Create fork`.

After that, GitHub will create your own copy of the project.

Example fork link:

```text
https://github.com/YOUR-USERNAME/classroom-occupancy-system
```

## How to Import Your Fork in VS Code

### 1. Copy your fork link

Open your fork on GitHub, click `Code`, and copy the HTTPS link.

Example:

```text
https://github.com/YOUR-USERNAME/classroom-occupancy-system.git
```

### 2. Clone your fork in VS Code

1. Open Visual Studio Code.
2. Press `Ctrl+Shift+P` to open the Command Palette.
3. Search for `Git: Clone`.
4. Paste your fork link.
5. Choose where to save the project on the computer.
6. Click `Open` when VS Code asks whether to open the cloned repository.

### 3. Install the project requirements

Open the VS Code terminal and run:

```powershell
pip install -r requirements.txt
```

### 4. Run the Flask app

From the project folder, run:

```powershell
python backend/app.py
```

Then open the local address shown in the terminal, usually:

```text
http://127.0.0.1:5000
```

## How to Push Changes from VS Code Back to Your Fork

After making changes in VS Code, you can send those changes to your fork on GitHub.

### 1. Save your changes

Make your edits in VS Code and save the files.

### 2. Open Source Control

1. In VS Code, click the `Source Control` icon on the left sidebar.
2. Review the files listed under changes.

### 3. Commit your changes

1. Type a short commit message, such as `Updated README instructions`.
2. Click `Commit`.

If VS Code asks you to stage changes first, choose `Yes`.

### 4. Push to your fork

1. Click `Sync Changes` or `Push` in VS Code.
2. If asked to sign in to GitHub, complete the sign-in process.

Your changes will then be uploaded to your fork on GitHub.

### Optional: Push using the terminal instead

You can also use the VS Code terminal:

```powershell
git add .
git commit -m "Updated README instructions"
git push origin main
```

If you are working on another branch, replace `main` with your branch name.

### Optional: Create a pull request

If you want your changes to be reviewed and merged into the original repository, open your fork on GitHub and click `Compare & pull request`.

## Notes

- This repository currently contains starter code and placeholders.
- The backend serves the frontend files from the `frontend/` folder.

hello sulits
hello hysdas