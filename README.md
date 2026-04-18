<h1 align="center">autOScan-agent</h1>

<p align="center">
  <strong>WhatsApp agent for grading OS lab submissions.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.12+-3776AB?style=flat&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/license-MIT-24292e?style=flat" />
</p>

---

## Overview

WhatsApp interface to [autOScan-engine](https://github.com/autoscan-lab/autOScan-engine). Send a zip of student submissions with a caption like `grade S0`, get a summary and an Excel workbook back. No tooling required on the user's end.

The agent uses Groq to interpret natural language, pulls the lab policy from Cloudflare R2, forwards the zip to the engine for compilation and static analysis, and replies with the results.

## How it works

1. User sends a zip + lab name (e.g. `grade S0`) via WhatsApp
2. Agent downloads the zip and loads the policy for that lab from R2
3. Engine compiles each submission and checks for banned functions
4. Agent sends back a summary and an `.xlsx` workbook with per-student results

## Stack

- FastAPI + Meta WhatsApp Cloud API
- Groq (Llama 3.3 70B)
- Cloudflare R2 for lab policy storage
- autOScan-engine (HTTP)
- Excel workbook export via openpyxl

## Deploy

1. Copy `.env.example` to `.env` and fill in your credentials
2. Deploy the engine first — see [autOScan-engine](https://github.com/autoscan-lab/autOScan-engine)
3. `fly secrets import < .env && fly deploy`
4. Point your Meta webhook to `https://<your-app>.fly.dev/webhook`

## What's next

See [TODO.md](TODO.md).

## License

MIT
