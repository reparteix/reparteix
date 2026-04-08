# [1.20.0](https://github.com/reparteix/reparteix/compare/v1.19.0...v1.20.0) (2026-04-07)


### Bug Fixes

* regenerate member IDs in copy import; guard CompressionStream compatibility ([faf34be](https://github.com/reparteix/reparteix/commit/faf34be74124b9a18f0c00f44fd1e25ac60a7ae2))


### Features

* share group via URL with compressed base64url payload ([50cd1d0](https://github.com/reparteix/reparteix/commit/50cd1d008cd95c13c25a8ad06217689b0868558d))

# [1.19.0](https://github.com/reparteix/reparteix/compare/v1.18.0...v1.19.0) (2026-04-07)


### Features

* fer sticky la data de la despesa a la llista mentre fas scroll ([289b0af](https://github.com/reparteix/reparteix/commit/289b0afcf380b0f52643d0dbba8bb6dd769b30ef))

# [1.18.0](https://github.com/reparteix/reparteix/compare/v1.17.0...v1.18.0) (2026-04-06)


### Bug Fixes

* guard against missing STAGING_TOKEN in pr-preview workflow ([4530a76](https://github.com/reparteix/reparteix/commit/4530a76f0c572ae7c26b4d7328575b9282248749))


### Features

* add GitHub deployment status to PR preview workflow ([5718b8b](https://github.com/reparteix/reparteix/commit/5718b8b7d7e8ee930290efc4b04b855ee340ce45))
* add PR preview deployments with configurable base path ([77860ea](https://github.com/reparteix/reparteix/commit/77860ea71bbc2788300ac795e20e21d4ba8ddaae))

# [1.17.0](https://github.com/reparteix/reparteix/compare/v1.16.0...v1.17.0) (2026-04-05)


### Features

* de-emphasize add-member action to reduce accidental triggers ([d052315](https://github.com/reparteix/reparteix/commit/d0523154696a063cf719d2c052ed84ae8b0b7316))

# [1.16.0](https://github.com/reparteix/reparteix/compare/v1.15.0...v1.16.0) (2026-03-31)


### Features

* fixed full-screen layout in GroupDetail — only tab content scrolls ([1037ae4](https://github.com/reparteix/reparteix/commit/1037ae41d61141f6445a592c67b3380684152d7a))
* sticky group title header in GroupDetail view ([39eace6](https://github.com/reparteix/reparteix/commit/39eace6f5e1b507cdf65cd6d5622b45936b150d6))

# [1.15.0](https://github.com/reparteix/reparteix/compare/v1.14.0...v1.15.0) (2026-03-31)


### Features

* afegir total per dia a la capçalera del grup ([cb649b8](https://github.com/reparteix/reparteix/commit/cb649b8beb8284a12ced65b2b14493b54e9705f9))
* ordenar i agrupar despeses per dia ([10eca2a](https://github.com/reparteix/reparteix/commit/10eca2a4a757ac30ca6b6e70ba40a9322533dc9d))

# [1.14.0](https://github.com/reparteix/reparteix/compare/v1.13.0...v1.14.0) (2026-03-31)


### Features

* add dark mode support with theme toggle ([212f333](https://github.com/reparteix/reparteix/commit/212f3333af471405261678df301609c69300106b))

# [1.13.0](https://github.com/reparteix/reparteix/compare/v1.12.3...v1.13.0) (2026-03-31)


### Bug Fixes

* use vitest/config defineConfig and add PR CI workflow ([36e20b2](https://github.com/reparteix/reparteix/commit/36e20b2469e334602e766a622706fe0253f17eb4))


### Features

* add store tests, coverage config, and CI coverage reporting ([cd84f46](https://github.com/reparteix/reparteix/commit/cd84f4664bb8ddeb04489ade7a94f8f4b5095402))

## [1.12.3](https://github.com/reparteix/reparteix/compare/v1.12.2...v1.12.3) (2026-03-31)


### Bug Fixes

* corregir color text botons eliminar (destructive-foreground) ([a9fd543](https://github.com/reparteix/reparteix/commit/a9fd5430fc1be3e91ad2c7c95d3221da09228f94))

## [1.12.2](https://github.com/reparteix/reparteix/compare/v1.12.1...v1.12.2) (2026-03-31)


### Bug Fixes

* corregir importació de fitxers - el redirect ara funciona correctament ([f9b714b](https://github.com/reparteix/reparteix/commit/f9b714b078f6b619f262f6ef1f8366240210f1ad))

## [1.12.1](https://github.com/reparteix/reparteix/compare/v1.12.0...v1.12.1) (2026-03-30)


### Bug Fixes

* **ci:** restore push trigger for GitHub Pages deploy workflow ([80351c3](https://github.com/reparteix/reparteix/commit/80351c32ab5f902cab8e4905a643342ec76e56c6))

# [1.12.0](https://github.com/reparteix/reparteix/compare/v1.11.0...v1.12.0) (2026-03-30)


### Features

* millora disseny home – gradient header, empty state, progressive form ([17f8208](https://github.com/reparteix/reparteix/commit/17f82081730369fb88598b4b8de546c06d325ee2))
* redesign GroupList home page for better UX ([99c25be](https://github.com/reparteix/reparteix/commit/99c25bea53f73c1cf014ef6cebd517e8300a37fb))

# [1.11.0](https://github.com/reparteix/reparteix/compare/v1.10.0...v1.11.0) (2026-03-30)


### Features

* add PWA install prompt and fix version in deploys ([542c2a2](https://github.com/reparteix/reparteix/commit/542c2a2d2060b4b6d3e59f7026f3d0a3ccc276e1))

# [1.10.0](https://github.com/reparteix/reparteix/compare/v1.9.1...v1.10.0) (2026-03-30)


### Bug Fixes

* address review comments — typo, filename, and jsdoc ([242157b](https://github.com/reparteix/reparteix/commit/242157b48cd552009b1ac3592494c08a4315eadb))


### Features

* **pwa:** add ReparteixExportV1 envelope, file handling, and legacy import support ([cd68952](https://github.com/reparteix/reparteix/commit/cd68952f7e2c44f20f2d3cfed3444f361012ccd0))

## [1.9.1](https://github.com/reparteix/reparteix/compare/v1.9.0...v1.9.1) (2026-03-30)


### Bug Fixes

* **pages:** use root base path for custom domain app.reparteix.cat ([84334ca](https://github.com/reparteix/reparteix/commit/84334ca109c51a1b85300cdd9907f8ee6d8e8912))

# [1.9.0](https://github.com/pilipilisbot/reparteix/compare/v1.8.0...v1.9.0) (2026-03-30)


### Features

* **sync:** processar JSON per actualitzar un grup (base de sincronització) ([a55aa9b](https://github.com/pilipilisbot/reparteix/commit/a55aa9b88dfe5e59412c28058a115cd646e65938))

# [1.8.0](https://github.com/pilipilisbot/reparteix/compare/v1.7.0...v1.8.0) (2026-03-30)


### Features

* Import/Export JSON local per backup i migració ([7559da4](https://github.com/pilipilisbot/reparteix/commit/7559da413ffdf26f4c48a8b7cecdfc8915f1ee7a))

# [1.7.0](https://github.com/pilipilisbot/reparteix/compare/v1.6.0...v1.7.0) (2026-03-29)


### Features

* add confirmation dialog before deleting items ([b65b56f](https://github.com/pilipilisbot/reparteix/commit/b65b56f21a217c735d8d25159d324cf8c270f189))

# [1.6.0](https://github.com/pilipilisbot/reparteix/compare/v1.5.0...v1.6.0) (2026-03-29)


### Features

* millora disseny - total grup, color pagador, fix posició foto tiquet ([6aae86f](https://github.com/pilipilisbot/reparteix/commit/6aae86f69a04e45393e98e00669378dcc0cf6d8d))

# [1.5.0](https://github.com/pilipilisbot/reparteix/compare/v1.4.0...v1.5.0) (2026-03-29)


### Features

* add direct camera capture option for expense receipts ([9117b25](https://github.com/pilipilisbot/reparteix/commit/9117b25ead20d0bca1a081fead1489f8814937b6))

# [1.4.0](https://github.com/pilipilisbot/reparteix/compare/v1.3.0...v1.4.0) (2026-03-29)


### Features

* add proportional expense splitting ([eb5a179](https://github.com/pilipilisbot/reparteix/commit/eb5a17948442226f25f77da099f0e8e23a150f19))

# [1.3.0](https://github.com/pilipilisbot/reparteix/compare/v1.2.0...v1.3.0) (2026-03-29)


### Bug Fixes

* address code review issues in receipt photo feature ([bdb964c](https://github.com/pilipilisbot/reparteix/commit/bdb964c9319225e3efaee2242d3881c4b71afba7))
* address receipt photo code review issues ([ac0a188](https://github.com/pilipilisbot/reparteix/commit/ac0a1886c40672696f8c273ce2a4e6ba4dae9301))
* address receipt photo code review issues (capture, reset timing, type safety) ([834edd4](https://github.com/pilipilisbot/reparteix/commit/834edd47b9f26e3d294f6e42a9003dc0f4c1a0a0))
* improve receipt modal accessibility (aria-modal, keyboard handling, focus management) ([eaec6c2](https://github.com/pilipilisbot/reparteix/commit/eaec6c2c906ea4837dafa3f07f43888adc7ca82f))


### Features

* add receipt photo to expenses ([f93601e](https://github.com/pilipilisbot/reparteix/commit/f93601e0c996c78462b4c5fc3b2b5e81a79aff08))
* add receipt photo to expenses ([8be1b92](https://github.com/pilipilisbot/reparteix/commit/8be1b92bacbc37fe5aeb1093383df924267b411e))

# [1.2.0](https://github.com/pilipilisbot/reparteix/compare/v1.1.0...v1.2.0) (2026-03-29)


### Features

* simplify group creation and add group settings page ([db163fc](https://github.com/pilipilisbot/reparteix/commit/db163fccbe08b87c3a74435e5ac6740052dc2252))

# [1.1.0](https://github.com/pilipilisbot/reparteix/compare/v1.0.0...v1.1.0) (2026-03-29)


### Features

* prevent deleting members with movements and allow renaming ([a92c769](https://github.com/pilipilisbot/reparteix/commit/a92c7693ca5ace41e1ec9b62d2aa20cff3c2c63d))

# 1.0.0 (2026-03-29)


### Bug Fixes

* add .npmrc with legacy-peer-deps to resolve vite-plugin-pwa peer dep conflict with vite 8 ([8db124d](https://github.com/pilipilisbot/reparteix/commit/8db124da6a7bdea98ff7badc10942b521c0d04a3))
* add input validation and payment recording feedback ([1191dd5](https://github.com/pilipilisbot/reparteix/commit/1191dd586601630f43b6926abfaa4699cc8078fc))
* add missing runtime and test dependencies for CI build ([b31cd42](https://github.com/pilipilisbot/reparteix/commit/b31cd42d7454dd885bc5ce464d67030996ab6083))
* address code review feedback - title attr, remove invalid required on Radix Select ([20c44ac](https://github.com/pilipilisbot/reparteix/commit/20c44ac7ad085c574f41b4c1b98bdd0bc527eea7))
* clean up setInterval on component unmount in PWAUpdatePrompt ([58282ea](https://github.com/pilipilisbot/reparteix/commit/58282ea99be327b76794a2febe1b4aa46f7464ed))
* **release:** add missing semantic-release plugins ([4ae00f5](https://github.com/pilipilisbot/reparteix/commit/4ae00f5f18dff4b3bc115b4841baa05a7f2076c3))
* remove unsupported required attr from Radix Select ([6af69f3](https://github.com/pilipilisbot/reparteix/commit/6af69f30c20733b3262046a4ed69126f582a9abf))
* use generic error message in SDK addMember ([3175ba8](https://github.com/pilipilisbot/reparteix/commit/3175ba83b6c63678d301a6e594e74a0337362192))


### Features

* add footer with version and made with love with AI text ([41d7d5b](https://github.com/pilipilisbot/reparteix/commit/41d7d5b340558c79640cf63364891717a7e21afb))
* add release workflow and CHANGELOG.md ([8312e17](https://github.com/pilipilisbot/reparteix/commit/8312e1788fcb40f4de755d53b5de6050980ef2b3))
* add SKILL.md for OpenClaw agent compatibility ([7507ee3](https://github.com/pilipilisbot/reparteix/commit/7507ee38fb27ff178e5176220ae2580b57d36d14))
* convert app to installable PWA with service worker and offline support ([efc9935](https://github.com/pilipilisbot/reparteix/commit/efc9935c8c49c73eac41bee91f883184c65ee3e6))
* extract headless SDK and domain barrel exports ([a16c4e8](https://github.com/pilipilisbot/reparteix/commit/a16c4e86f59c78e5f0f7bedc268f3aeae4bcc970))
* fully automatic releases via semantic-release on merge to main ([744eba9](https://github.com/pilipilisbot/reparteix/commit/744eba98c362b13771d60729a96a6bd0ef859570))
* implement Phase 0 + Phase 1 MVP - project setup and core local functionality ([b6160ba](https://github.com/pilipilisbot/reparteix/commit/b6160ba587bcababa81af343826614bdf5aebb00))
* install TailwindCSS v4, Zod, add settlements/payments UI ([5bb93c1](https://github.com/pilipilisbot/reparteix/commit/5bb93c1acf23125fb67a88b15e52ee2e7fe1435b))
* integrate shadcn/ui components across all features ([99d7af5](https://github.com/pilipilisbot/reparteix/commit/99d7af5d562aa9905c1195992436cb0e1add6e71))
* scaffold Reparteix app and enable GitHub Pages deployment ([461c057](https://github.com/pilipilisbot/reparteix/commit/461c057af5e80f51b43f56ddd18b67af711b7f56))

# Changelog

All notable changes to this project will be documented in this file.
This file is auto-generated by [semantic-release](https://semantic-release.gitbook.io/semantic-release/) on every merge to `main`.

## [v1.0.0] - 2026-03-29

### Added
- Footer with running version and "Fet amb ❤️ i molta IA" attribution
- PWA support with offline-first architecture and update prompt
- GitHub Actions workflow for automated releases with changelog
- Expense splitting across multiple groups with balance calculation
- Settlement tracking for paid debts
- Local-first data storage via IndexedDB (Dexie)
- Sync via encrypted GitHub Gist snapshot
