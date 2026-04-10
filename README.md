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

WhatsApp-based interface to [autOScan-engine](https://github.com/autoscan-lab/autOScan-engine). Send a zip of student submissions via WhatsApp, get structured grades exported to an Excel workbook.

## Stack

- FastAPI + Meta WhatsApp Cloud API
- Groq (Llama 3.3 70B) for natural language dispatch
- HTTP calls to a private autOScan engine service
- Excel workbook export for grade output

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in your credentials
3. `pip install -r requirements.txt`
4. `make dev`

## License

MIT
