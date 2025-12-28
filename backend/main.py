import asyncio
import json
import os
import subprocess
from typing import List, Dict, Any, Optional, Union
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from openai import OpenAI
from dotenv import load_dotenv
from duckduckgo_search import DDGS

load_dotenv()

app = FastAPI()

# --- Helper Functions ---

def get_project_structure(path: str = ".") -> str:
    ignore_dirs = {".git", "__pycache__", "node_modules", "venv", ".venv", ".env", "dist", "build"}
    structure = []
    try:
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            level = root.replace(path, '').count(os.sep)
            indent = '  ' * level
            if root == path:
                structure.append(os.path.basename(os.path.abspath(path)) + "/")
            else:
                structure.append(f"{indent}{os.path.basename(root)}/")
            subindent = '  ' * (level + 1)
            for f in files:
                structure.append(f"{subindent}{f}")
    except Exception as e:
        return f"Error generating structure: {e}"
    return "\n".join(structure)

# --- Tools Implementation ---

def read_file(path: str) -> str:
    try:
        if not os.path.exists(path):
            return f"Error: File '{path}' not found."
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {str(e)}"

def write_file(path: str, content: str) -> str:
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote to {path}"
    except Exception as e:
        return f"Error writing file: {str(e)}"

def run_terminal_command(command: str) -> str:
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=os.getcwd(),
            text=True,
            capture_output=True,
            timeout=15
        )
        output = result.stdout
        if result.stderr:
            output += f"\nSTDERR:\n{result.stderr}"
        return output.strip() or "(No output)"
    except subprocess.TimeoutExpired:
        return "Error: Command timed out."
    except Exception as e:
        return f"Error executing command: {str(e)}"

def web_search(query: str) -> str:
    """Performs a web search using DuckDuckGo."""
    try:
        results = DDGS().text(keywords=query, max_results=5)
        if not results:
            return "No results found."
        formatted_results = []
        for r in results:
            formatted_results.append(f"Title: {r['title']}\nLink: {r['href']}\nSnippet: {r['body']}\n")
        return "\n---".join(formatted_results)
    except Exception as e:
        return f"Error performing web search: {str(e)}"

# --- OpenAI Configuration ---

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file.",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string"}},
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file. Overwrites existing content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string"}
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_terminal_command",
            "description": "Run a shell command.",
            "parameters": {
                "type": "object",
                "properties": {"command": {"type": "string"}},
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for documentation, solutions, or libraries.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "The search query."}},
                "required": ["query"]
            }
        }
    }
]

PROMPT_AGENT = """
You are a Senior Software Engineer. Act autonomously. Plan first.
You can read files, write files, run terminal commands, and search the web.
If you see an image, analyze it to understand the bug or error.
Current Structure:
{structure}
"""

PROMPT_CHAT = """
You are a Code Assistant. READ-ONLY mode.
Current Structure:
{structure}
"""

# --- Agent Session Management ---

class AgentSession:
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.messages = []
        self.mode = "agent"

    async def initialize(self, mode: str):
        self.mode = mode
        structure = get_project_structure()
        prompt = PROMPT_AGENT if mode == "agent" else PROMPT_CHAT
        self.messages = [{"role": "system", "content": prompt.format(structure=structure)}]
        
        await self.websocket.send_json({
            "type": "thought",
            "content": f"Session started in {mode} mode. I'm ready."
        })

    async def handle_message(self, user_content: str, images: Optional[List[str]] = None):
        # Handle Multimodal Input
        if images and len(images) > 0:
            content_block = [{"type": "text", "text": user_content}]
            for img in images:
                content_block.append({
                    "type": "image_url",
                    "image_url": {"url": img}
                })
            self.messages.append({"role": "user", "content": content_block})
        else:
            self.messages.append({"role": "user", "content": user_content})
        
        allowed_tools = TOOL_DEFINITIONS
        if self.mode == "chat":
            # Chat mode restricted tools
            allowed_tools = [t for t in TOOL_DEFINITIONS if t["function"]["name"] in ["read_file", "web_search"]]

        # Loop for tool handling
        for _ in range(10):
            try:
                stream = client.chat.completions.create(
                    model="gpt-4o",
                    messages=self.messages,
                    tools=allowed_tools if allowed_tools else None,
                    stream=True
                )
            except Exception as e:
                await self.websocket.send_json({"type": "thought", "content": f"LLM Error: {e}"})
                return

            current_thought_id = f"thought-{os.urandom(4).hex()}"
            current_thought_content = ""
            tool_calls = {}

            for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    current_thought_content += delta.content
                    await self.websocket.send_json({
                        "id": current_thought_id,
                        "type": "thought",
                        "content": current_thought_content
                    })
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls:
                            tool_calls[idx] = {"id": tc.id, "name": tc.function.name, "args": ""}
                        if tc.function.name: tool_calls[idx]["name"] = tc.function.name
                        if tc.function.arguments: tool_calls[idx]["args"] += tc.function.arguments

            if current_thought_content:
                self.messages.append({"role": "assistant", "content": current_thought_content})

            if not tool_calls:
                break

            # Handle Tool Calls
            tool_calls_msg = []
            for idx in sorted(tool_calls.keys()):
                tc = tool_calls[idx]
                tool_calls_msg.append({
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["args"]}
                })
            
            self.messages.append({
                "role": "assistant",
                "content": current_thought_content or None,
                "tool_calls": tool_calls_msg
            })

            for idx in sorted(tool_calls.keys()):
                tc = tool_calls[idx]
                func_name = tc["name"]
                call_id = tc["id"]
                try:
                    args = json.loads(tc["args"])
                except:
                    args = {}
                    
                event_id = f"evt-{call_id}"

                if func_name == "run_terminal_command":
                    cmd = args.get("command", "")
                    await self.websocket.send_json({"id": event_id, "type": "command", "command": cmd, "output": ""})
                    output = run_terminal_command(cmd)
                    await self.websocket.send_json({"id": event_id, "type": "command", "command": cmd, "output": output})
                
                elif func_name == "read_file":
                    path = args.get("path", "")
                    await self.websocket.send_json({"id": event_id, "type": "file_read", "path": path})
                    content = read_file(path)
                    output = content
                    await self.websocket.send_json({
                        "id": event_id, 
                        "type": "file_read", 
                        "path": path, 
                        "lines": len(content.splitlines()), 
                        "content_preview": content[:500]
                    })

                elif func_name == "write_file":
                    path = args.get("path", "")
                    content = args.get("content", "")
                    await self.websocket.send_json({
                        "id": event_id, 
                        "type": "file_write", 
                        "path": path, 
                        "content_preview": content[:200] + "..."
                    })
                    output = write_file(path, content)
                    await self.websocket.send_json({"id": event_id, "type": "file_write", "path": path, "output": output})

                elif func_name == "web_search":
                    query = args.get("query", "")
                    await self.websocket.send_json({"id": event_id, "type": "command", "command": f"web_search '{query}'", "output": "Searching..."})
                    output = web_search(query)
                    await self.websocket.send_json({"id": event_id, "type": "command", "command": f"web_search '{query}'", "output": output})
                
                else:
                    output = "Error: Tool not found."

                self.messages.append({"role": "tool", "tool_call_id": call_id, "content": output})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session = AgentSession(websocket)
    initialized = False
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # --- Handle File Viewer Requests ---
            if message.get("type") == "get_file_content":
                path = message.get("path")
                content = read_file(path)
                await websocket.send_json({
                    "type": "file_content",
                    "path": path,
                    "content": content
                })
                continue

            if not initialized:
                await session.initialize(message.get("mode", "agent"))
                initialized = True
                if message.get("content") or message.get("images"):
                    await session.handle_message(message.get("content", ""), message.get("images", []))
            else:
                if message.get("type") == "user_message":
                    await session.handle_message(message.get("content", ""), message.get("images", []))
            
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WS Error: {e}")