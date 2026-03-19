.PHONY: dev lint fmt

dev:
	uvicorn app.main:app --reload --port 8000

lint:
	ruff check app/

fmt:
	ruff format app/
