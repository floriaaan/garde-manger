# AGENTS.md

## Command execution policy

Be cost-conscious when executing commands.

* **Do not automatically run tests, builds, lint, typechecks, E2E tests, benchmarks, coverage, or other expensive commands.**
* **Only execute costly commands when the user explicitly requests them or when they are genuinely necessary to diagnose a specific reported issue.**
* When execution is necessary, prefer the **smallest and most targeted command** possible.
* **Writing and modifying tests is allowed and encouraged** when appropriate. This policy only restricts their execution.
* Prefer lightweight validation such as inspecting code, reviewing diffs, searching files, and checking configuration.
* Do not run expensive commands merely to "verify" work or out of habit.
* Do not repeat an expensive command when its previous result is still valid.
* Do not install dependencies, rebuild Docker images, restart services, run migrations, or perform other costly operations unless necessary or explicitly requested.
* Never perform destructive operations just for validation.

### Default

**Write the code and tests. Inspect the changes. Stop.**

**Do not execute expensive commands unless explicitly asked or genuinely required to diagnose an issue.**

### Validation

Do not run expensive validation commands automatically.

Tests, builds, lint, typechecks, E2E, benchmarks, coverage and similar commands:
- may be written/modified but must not be executed unless explicitly requested or genuinely required for diagnosis;
- must not be repeatedly rerun in a fix → test → fix loop;
- when execution is necessary, run the smallest targeted command possible.

## Architecture conventions

Read and follow [docs/clean-architecture.md](docs/clean-architecture.md) before
changing backend, mobile or landing code. It is the reference for layer ownership,
dependency injection, naming and the documented pragmatic exceptions.

- Keep domain independent and dependencies directed inward; never bypass a layer
  through a provider or a re-export.
- Backend modules use classes and constructor-injected ports. Infrastructure is
  selected in providers, not in use cases. Controllers resolve use cases from
  provider bindings; never assemble them with `new`.
- Frontend components and hooks use functions; inject connectors through the
  existing context/query helpers instead of importing concrete implementations.
- Preserve behavior during architecture cleanup; fix concrete violations without
  adding speculative abstractions or reorganizing unrelated features.
- Update the architecture guide when a convention changes. The command execution
  policy above still applies: do not automatically run boundary checks or tests.

## Mandatory contextual logging

Follow the logging section in [docs/clean-architecture.md](docs/clean-architecture.md).
Every business operation must emit a structured completion/refusal/failure log.
Use the existing request/action logger, job context, mobile telemetry port or
injected landing logger. Carry the available operation/use case, request/trace,
user/household/entity IDs, duration, outcome and structured error context.
Include non-sensitive business parameters through the explicit allowlist only;
never dump request bodies, arguments, results, secrets or personal free text.
Preserve context across awaits and isolate concurrent requests/jobs. Remote
telemetry being disabled must not silently remove local logging.
