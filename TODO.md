# autOScan-agent TODO

## Next

- [ ] Update agent result parsing for autOScan-engine `v1.3.0`.
  - Engine `/grade` now returns each row using the engine shape: `submission`, `compile`, `scan`, `status`, plus server extras like `tests`, `grade`, `notes`, and `source_files`.
  - Replace old flat reads (`id`, `path`, `c_files`, `compile_ok`, `compile_time_ms`, `compile_timeout`, `stderr`, `exit_code`, `banned_count`, `banned_hits`) with nested reads from `submission.*`, `compile.*`, and `scan.hits`.
  - Keep the UI-facing `StudentRow` shape stable so chat messages, inspector, and stored R2 results do not all need to change at once.
  - Add payload validation around the new shape before persisting results.

- [ ] Expose per-test diagnostics end-to-end.
  - Engine service: keep full `run-test-case` payload (not summary-only).
  - Agent: store/map per-case fields (`status`, `output_match`, expected/actual output, diff lines).
  - Inspector: render failing-case details and diff.

- [ ] Add similarity + AI detection to cloud flow.

## Later

- [ ] Reintroduce client-side export (XLSX) from stored run data.
