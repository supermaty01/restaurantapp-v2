TT PCP only — Azure DevOps (ADO) MCP for PCP work items when fetching/searching bugs, PBIs, or attachments (ignore outside PCP)

# PCP Azure DevOps (ADO) Work Items

**Scope:** Only when working on TT PCP / Private Client Portal ADO items. Do not apply to other Azure DevOps projects or non-PCP workspaces.

Use the `user-ado` MCP for all Azure DevOps work item lookups. Apply these defaults every time.

## Defaults

| Setting | Value |
|---|---|
| Organization | `netprogroup` |
| Project | `Trident Trust - Private Client Portal` |
| Current user | `mateo@netprogroup.com` |

- Always pass project `"Trident Trust - Private Client Portal"` on ADO tool calls that accept `project` (do not wait for a project picker).
- When the request implies “my” / “assigned to me” / current user, use `mateo@netprogroup.com` (e.g. `assignedTo`, filters, or interpreting “my items”). Prefer `wit_my_work_items` when listing the authenticated user’s items; use the email when a tool needs an explicit assignee.

## Authentication (first call only)

ADO MCP auth can open a browser window per parallel request. **Never fire many ADO calls at once on a cold/unauthenticated session.**

1. Make **exactly one** ADO request first (e.g. fetch the first work item, or a lightweight project call).
2. Wait until that call succeeds (user has logged in if prompted).
3. Only then proceed with the remaining items — batch/parallel is fine after auth is established.
4. Prefer `wit_get_work_items_batch_by_ids` when loading many known IDs after the session is authenticated.

## Fetching item context

1. Load the work item with relations expanded (`expand: "relations"` or `"all"` when needed).
2. **Always check child items** (parent→child links). Fetch children for acceptance criteria, split tasks, and implementation detail.
3. **Always check comments** via `wit_list_work_item_comments`. Discussion threads often hold clarifications, decisions, repro steps, and other context missing from the description.
4. If the item description/title is still unclear, also inspect other related items (parent, related, predecessor/successor, duplicates) for context.

## Attachments

- Download attachments via `wit_get_work_item_attachment` when present.
- Prefer reading content with available MCPs:
  - **Word (`.docx`)** → `user-docx-mcp`
  - **PDF** → `user-pdf-reader`
- Images and other readable formats: open/inspect when possible.
- **If an attachment cannot be read** (unsupported type, MCP failure, corrupt/empty download, etc.): **tell the user explicitly**, including the file name. Do not silently skip — important context may be lost.
