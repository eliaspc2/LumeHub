# Codex Orchestrator

Operational module for direct Codex management of LumeHub.

It reuses the existing LumeHub modules for admin settings, people memory, group directory, group LLM instructions and schedule events. The module is intentionally narrow: it gives Codex a stable CLI surface to synchronize the app owner from a text file, lock down assistant scope, manage group prompts and create scheduled message events.

Default admin phone file:

```text
runtime/lxd/host-mounts/data/config/admin-phone.txt
```

The file should contain one phone number, for example `+351910000000`. The orchestrator normalizes it to the WhatsApp JID form used internally.
