# Browser Execution Rule for Antigravity

- **Browser to use**: ALWAYS use **Google Chrome** (`C:\Program Files\Google\Chrome\Application\chrome.exe`) for all web browsing, URL launching, automated browsing, and web testing within Antigravity.
- **Do NOT use Microsoft Edge**: Even though Microsoft Edge is configured as the default Windows OS browser for the user, Antigravity must NEVER use Edge or rely on `Start-Process <URL>` (which falls back to the system default).
- **Explicit invocation**: When opening or inspecting URLs in a browser via terminal/scripts, always invoke Chrome explicitly:
  ```powershell
  Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "<URL>"
  ```
  or with remote debugging if needed:
  ```powershell
  Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "<URL>", "--remote-debugging-port=9222"
  ```
- **Preserve OS settings**: Do NOT ask the user to change their Windows default browser. The user explicitly keeps Edge as their default Windows application while reserving Chrome for Antigravity.
