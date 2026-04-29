# Draft: TFGPL Sample Code Update

## Requirements (confirmed)
- Update all sample source code in `D:\sources\가이드\tfg-spl-tfgpl` to use latest `tfg-lib-tfgmb` and `tfg-lib-tfgsu`
- Write all possible updated code for the TFGPL-side samples
- Ensure compatibility with latest library APIs

## Technical Decisions
- Follow latest API patterns from `tfg-lib-tfgmb` and `tfg-lib-tfgsu`
- Preserve existing sample structure and use cases where possible
- Update all imports, method calls, and type references to match latest library versions
- Include updated test samples if test infrastructure exists

## Research Findings
- Target sample directory: `D:\sources\가이드\tfg-spl-tfgpl`
- Dependency libraries: `tfg-lib-tfgmb`, `tfg-lib-tfgsu` (located in `D:\sources\가이드\` per user context)
- Need to map: existing sample files, current library usage, latest library APIs

## Open Questions
- None (automated mode, proceeding with context provided)

## Scope Boundaries
- INCLUDE: All sample files in `tfg-spl-tfgpl` that use `tfg-lib-tfgmb`/`tfg-lib-tfgsu`
- EXCLUDE: Modifying the library code itself, other sample projects in `가이드` folder
