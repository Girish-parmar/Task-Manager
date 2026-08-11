# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

This repository is a fresh scaffold. As of now it contains only `README.md`:

```
# Task-Manager
Task Manager #Track and trace Task
```

There is no application code, no package manifest (e.g. `package.json`, `pom.xml`, `requirements.txt`), no build configuration, no test suite, and no directory structure beyond the repository root. There are consequently no build, lint, or test commands to document yet, and no architecture to describe.

## Guidance for future work

- Once source code, a package manifest, or build tooling is added to this repository, update this file with:
  - The actual commands used to install dependencies, build, lint, and run tests (including how to run a single test).
  - The high-level architecture — how major components fit together — once that structure exists.
  - Any project-specific conventions established by the codebase (naming, module layout, state management approach, etc.).
- Do not assume a particular language or framework for this "Task Manager" project until one is actually chosen and reflected in the repository.
