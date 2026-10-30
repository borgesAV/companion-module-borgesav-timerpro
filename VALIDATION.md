# Validation record — 2026-10-30

- Module 1.0.2: automated tests use the real @companion-module/base 2.0.4 library and a local HTTP simulator. These are not hardware or network-load tests.
- Real Companion 5.0.3 and the installed Borges AV Timer were operated together: duration actions, running/paused state, time variable and button feedbacks were checked. The operator confirmed the corrected Companion controls work.
- The legacy display button was corrected in the local Companion configuration and checked at 03:00 (black text/yellow background) and 01:00 (white text/red background). The test finished at 05:00 paused. Current presets explicitly include feedback styles; upgrading a module does not overwrite existing button customisations.
- Timer 2.4.14 Release build, WPF/profile/alpha/QR regression checks and 28 licence checks passed. The operator subsequently reported that profile and NDI validation steps were completed successfully. This is operator-reported acceptance, not a new automated receiver test.
- No guarantee of an arbitrary NDI receiver count or Wi-Fi capacity. NDI transmission remains the application/runtime responsibility; the module does not impose a receiver limit.
- Official catalogue publication is not complete. The repository request remains pending and a tagged module version still requires Bitfocus review after repository approval.
