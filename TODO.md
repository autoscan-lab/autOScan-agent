# autOScan-agent TODO

## Next

- [ ] Expose per-test diagnostics end-to-end.
  - Inspector: render failing-case details and diff.

- [ ] Add UI controls for similarity + AI detection.
  - App route exists at `/api/engine/grade` with `include_similarity=1` and `include_ai_detection=1`.
  - Design how the inspector should render reports before turning the flags on in the chat tool.

## Later

- [ ] Reintroduce client-side export (XLSX) from stored run data.
