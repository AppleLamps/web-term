# AI Coding Agent (Headless Web UI)

A professional, full-stack AI coding assistant interface designed to mimic the aesthetic and functionality of high-end developer tools (like Claude Code). This project decouples the AI agent logic (Backend) from the user interface (Frontend), communicating via WebSockets for a real-time, streaming "IDE-like" experience.

## 🚀 Features

### Core Capabilities
*   **Dual Modes**:
    *   **Agent Mode**: Full autonomy. Can execute terminal commands, read/write files, and plan complex tasks.
    *   **Chat Mode**: Read-only safety guardrails. Can answer questions about the codebase but cannot modify it.
*   **Real-Time Streaming**: see the agent's "Thoughts", "Plans", and "Commands" as they happen via WebSockets.
*   **Project Awareness**: The agent scans your file structure on startup to understand the context immediately.

### Advanced Tooling
*   **Terminal Integration**: Executes shell commands (`ls`, `grep`, `npm test`, etc.) and streams output.
*   **File Operations**: Reads and Writes files with syntax-highlighted previews.
*   **Web Search**: Integrated `DuckDuckGo` search allows the agent to look up documentation and fix unknown errors.
*   **Vision (Multimodal)**: Drag-and-drop screenshots directly into the chat to debug UI issues or error logs using GPT-4o's vision capabilities.

### UI/UX
*   **"Pro" Aesthetic**: Clean, high-contrast, structured notebook design using Tailwind CSS.
*   **Integrated File Viewer**: Click on any file path in the chat to open a slide-over code editor panel.
*   **Syntax Highlighting**: VS Code-style dark theme for all code blocks.

---

## 🏗 Architecture

*   **Backend**: Python (FastAPI). Handles the OpenAI `gpt-4o` loop, tool execution (subprocess, file I/O), and WebSocket state management.
*   **Frontend**: React (Vite). Renders the event stream, manages the drag-and-drop zone, and provides the interactive file viewer.
*   **Communication**: WebSocket (`ws://localhost:8000/ws`) for bi-directional event streaming.

---

## 🛠️ Prerequisites

*   **Python 3.8+**
*   **Node.js 16+**
*   **OpenAI API Key** (Must support `gpt-4o`)

---

## 📦 Installation & Setup

### 1. Backend Setup

Navigate to the `backend` folder and set up the Python environment.

```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Configuration:**
Create a `.env` file in the `backend/` directory:

```env
OPENAI_API_KEY=sk-proj-your-key-here...
```

**Start the Server:**
```bash
uvicorn main:app --reload
```
The backend will start at `http://localhost:8000`.

### 2. Frontend Setup

Open a new terminal, navigate to the `frontend` folder.

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will start at `http://localhost:5173` (or similar).

---

## 🎮 Usage Guide

1.  **Open the Web UI**: Go to the URL provided by Vite (e.g., `http://localhost:5173`).
2.  **Select Mode**:
    *   Use **Agent** if you want the AI to write code or run commands.
    *   Use **Chat** if you just want to ask questions safely.
3.  **Interact**:
    *   **Text**: Type "Refactor main.py to use async functions."
    *   **Images**: Drag a screenshot of an error into the window and ask "How do I fix this?"
    *   **Files**: If the agent reads a file, click the filename (e.g., `backend/main.py`) to open the full code viewer on the right.

---

## ⚠️ Security Note

This agent has **Read/Write/Execute** access to the directory where the backend is running.
*   **Sandbox**: It is highly recommended to run this inside a Docker container or a virtual machine if you are testing untrusted instructions.
*   **Guardrails**: The `Chat` mode disables execution tools, but `Agent` mode allows `subprocess.run`. Use with caution.
