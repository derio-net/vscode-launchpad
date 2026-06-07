# README Truth, About Section, and Release Activation — Plan Narrative

## What this plan does

The repo's public face lies by omission and by drift: the About section is
empty, the README implies downloadable builds that don't publicly exist (the
only release is an invisible **draft** v0.1.10 from March), the manifests
claim version 1.0.0 while the only tag is v0.1.10, and two docs reference
files that don't exist (`CHANGELOG.md`) or exist under a different case
(`docs/macos-code-signing.md`).

The release *pipeline* itself already works — the draft holds 9 artifacts
across 4 platforms. What's missing is honesty and the final publish step.

## Shape of the work

**Phase 1** writes the regression guard first (TDD red): a server-side test
that extracts every file reference from the four top-level docs and the
workflow files, then asserts each target exists — **case-sensitively**, by
walking directory listings, because macOS APFS would happily "find"
`macos-code-signing.md` when only `MACOS-CODE-SIGNING.md` exists. The test
must fail on exactly the two catalogued breakages before any fix lands.

**Phase 2** fixes the two broken references (green). **Phase 3** rewrites the
README: download-first Desktop App section (the quarantine note moves to
where it's actually true), drops "future desktop app", adds the release badge
and the shipped column-customization feature. **Phase 4** aligns every
version field to 0.2.0 — the next tag the operator will push. Phases 2-4 are
independent of each other (all depend only on Phase 1's test where relevant).

**Phase 5** mutates the live repo via host-side gh (container has no gh
auth): sets the operator-approved About description + topics, and deletes the
stale draft release while keeping its tag (the v0.2.0 release notes diff
against it).

## What this plan deliberately does NOT do

- No tag push, no release publishing — that's the operator-driven post-merge
  Test Plan in the spec.
- No CHANGELOG.md creation — CI-generated release notes are the record.
- No code signing / notarization work.

## Execution notes

- fr-execute LOCAL mode in the `feat/readme-and-releases` isolation
  workspace; repo commands via `fr isolation exec`, gh mutations host-side.
- Spec: `docs/superpowers/specs/2026-06-07-readme-truth-and-releases-design.md`
  (operator Q&A decisions recorded there).
