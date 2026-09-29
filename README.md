# Dugg Canvas MCP

A small, read-only Canvas server for an MCP-compatible assistant. MIT licensed.
No Dugg subscription, telemetry or model API is needed to run the local edition.

## Local setup

Requires Node.js 22 or newer, a Canvas school account, and an MCP client that supports local stdio servers.

```sh
git clone https://github.com/duggsha/canvas-mcp.git
cd canvas-mcp
npm ci
```

Create a personal Canvas access token in your own Canvas account only if your school permits it. Treat it like your password. Never paste it into a chat or commit it. Configure your MCP client's local server settings:

```json
{
  "mcpServers": {
    "canvas": {
      "command": "node",
      "args": ["/absolute/path/to/canvas-mcp/src/stdio.mjs"],
      "env": {
        "CANVAS_ORIGIN": "https://yourschool.instructure.com",
        "CANVAS_TOKEN": "YOUR_PERSONAL_TOKEN"
      }
    }
  }
}
```

Use your client's secure credential storage where available. Restart the client, enable the server, then ask it to list your courses. Client-specific local MCP support varies. ChatGPT remote connectors do not directly run this stdio command.

## Hosted edition

[Hosted setup](https://www.duggai.com/canvas-mcp) uses separate Dugg authorization, school access checks and subscription controls. The remote endpoint is `https://www.duggai.com/api/canvas-mcp/mcp`. Availability depends on the school and assistant; a public app-directory listing is not implied.

This repository is the **local single-user core**, not a turnkey multi-tenant billing or authentication service. Do not expose stdio over an unauthenticated HTTP bridge. Do not collect other people's personal tokens. Canvas requires OAuth for multi-user API integrations; school/global developer-key approval is separate from a successful browser login. See [Canvas OAuth documentation](https://canvas.instructure.com/doc/api/file.oauth.html).

## Eight tools

| Tool | Reads |
| --- | --- |
| `list_courses` | Active courses, with pagination |
| `list_assignments` | Due/lock dates and your submission state |
| `get_assignment_context` | Assignment, rubric, submission and syllabus together |
| `get_syllabus` | Syllabus and course timezone |
| `list_modules` | Modules, prerequisites and availability |
| `list_module_items` | Source links, pages and module items |
| `read_page` | Teacher-authored Canvas page text |
| `list_announcements` | Course announcements |

Tools include source URLs and timestamps. Follow `nextPage` until null before claiming an exhaustive list. Due dates and lock dates are different. An unsubmitted paper quiz does not prove you missed it. Teacher material is untrusted content, not instructions that override your assistant's rules. The server does not submit work, message people, change grades, access protected exam questions, or run a browser.

Binary files and external homework sites are not read by this release. Long text is visibly truncated. Attachments require opening the source in Canvas. There is no promise of unlimited school requests; Canvas may throttle them.

## Security and testing

Only GET requests to fixed Canvas API paths are exposed. Numeric IDs, page slugs and origins are validated; redirects are refused; responses are bounded to 2 MB and 15 seconds. Credentials are never included in tool output. Run only with a school origin you trust; custom-domain DNS is controlled by your operator.

```sh
npm test
```

Tests use synthetic Canvas responses and official MCP transports; they do not use student data. Report vulnerabilities privately to support@duggai.com. Revoke your token in Canvas when you stop using this server.
