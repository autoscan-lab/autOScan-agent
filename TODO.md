# autOScan-agent TODO

## Next

- [ ] Expose per-test diagnostics end-to-end.
  - Engine service: keep full `run-test-case` payload (not summary-only).
  - Agent: store/map per-case fields (`status`, `output_match`, expected/actual output, diff lines).
  - Inspector: render failing-case details and diff.

## Then

- [ ] Add single test-case re-run from Inspector.
- [ ] Add runtime validation for engine payloads before saving to R2.
- [ ] Add similarity + AI detection to cloud flow.

## Later

- [ ] Reintroduce client-side export (XLSX/CSV) from stored run data.
