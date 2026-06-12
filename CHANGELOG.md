# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## 0.2.0 (2026-06-12)


### ⚠ BREAKING CHANGES

* **thresholds:** Thresholds fields green/amber/blue are now
earn/nearFree/cheap; external callers of /api/subscribe should send the
new shape (the legacy shape is still accepted).

* **thresholds:** rename threshold fields to match the levels they bound ([320cc23](https://github.com/blip456/stroom/commit/320cc23900134d3f4430506cafa5a4869164b151))


### Features

* add dag tab to period overview, replace jaar with dag/week/maand ([04f8838](https://github.com/blip456/stroom/commit/04f8838e9ef04c99b728e9fe7dae914f14b126dc))
* add daily summary card with cost vs goedkoop comparison ([5e6db42](https://github.com/blip456/stroom/commit/5e6db42e1d85d4f9edca79d0a78f8cd2b8631ef6))
* add Google Analytics page-view and feature tracking ([8f60b25](https://github.com/blip456/stroom/commit/8f60b252a9a9a6a61c7544a1a06f903354831929))
* add green hourly cost line on left y-axis ([2c53d15](https://github.com/blip456/stroom/commit/2c53d15a8eeb8138fbd4308c4d3b91ad115e6fcd))
* add semver versioning with conventional commits and build number ([4d2ba64](https://github.com/blip456/stroom/commit/4d2ba6487ad4d1d5fc5448fedbe7bab968ee2d1a))
* add week/month/year period selector to overview card ([79771cb](https://github.com/blip456/stroom/commit/79771cbfbe655fadf056c1b783fae6ee11c477bb))
* auto-rotate to landscape in fullscreen, disable text selection ([53cc127](https://github.com/blip456/stroom/commit/53cc1279acdfa3928de0ff25184b30baca2ca6e0))
* **changelog:** render CHANGELOG.md in-app and release every deploy as a minor ([547fca5](https://github.com/blip456/stroom/commit/547fca51bd69ad7bfc4a1e25caaff2089bd80f4d))
* chart fullscreen mode and touch-aware bar highlighting ([f3fb231](https://github.com/blip456/stroom/commit/f3fb231998c70b0682f595a673e2d830fde142fd))
* **chart:** dashed gray line marking the day's average price ([d2e8183](https://github.com/blip456/stroom/commit/d2e8183d84d136d6fefe1077638148b17eab4a64))
* **nav:** open a date picker when tapping the date in the chart header ([2d02362](https://github.com/blip456/stroom/commit/2d0236225343a145d4e251960bc0e9b2a113d59f))
* optimistic navigation and persistent chart bar selection ([98fcab7](https://github.com/blip456/stroom/commit/98fcab7c6890acc5c25c98451a84d9b49d80742c))
* optimistic navigation and persistent chart bar selection ([2c3f2e7](https://github.com/blip456/stroom/commit/2c3f2e781ab0f0587ae260f967ffe30266f494df))
* overhaul pricing source, UI color scheme, settings, and notifications ([0637929](https://github.com/blip456/stroom/commit/06379297f8ff0ed2355f8dc2d3d902eeffb1497e))
* overlay Fluvius meter data on price chart ([8a21cef](https://github.com/blip456/stroom/commit/8a21cef155db9630c622c0bae82c6df59c7e30cd))
* overlay Fluvius meter data on price chart ([f6ae1d7](https://github.com/blip456/stroom/commit/f6ae1d782dc79180ba543a418adac9c196211693))
* **planner:** show cheapest contiguous price block on the main page ([e66b9df](https://github.com/blip456/stroom/commit/e66b9dfb4940686fe45d703a795bdc0483e20f01))
* **settings:** show release version and short build tag in footer ([6ea6e6f](https://github.com/blip456/stroom/commit/6ea6e6f33acc470118b5a3901ec4d95f1041a613))
* **stats:** move period overview to a stats page with savings analytics ([056e193](https://github.com/blip456/stroom/commit/056e1933c648ca496139c7fcd90a53fdde871cd3))
* **stats:** period navigation and data-coverage summary ([a2d423a](https://github.com/blip456/stroom/commit/a2d423a2e1ac3a49391bb965cd39350fc4ab58e6))
* **stats:** show shift potential as a percentage of consumption cost ([03d6805](https://github.com/blip456/stroom/commit/03d6805c158f9af0cda704d146d01f09524b86bc))
* **ui:** derive legend labels from user thresholds and unify category names ([facba6b](https://github.com/blip456/stroom/commit/facba6b250c662b289a032766500baab0130dc3d))
* **week:** add week heatmap view of hourly prices ([2295b6d](https://github.com/blip456/stroom/commit/2295b6de10f7a4e6852151c411ecea25f64eb684))


### Bug Fixes

* add PNG icons and fix iOS push notification display ([cdfde2b](https://github.com/blip456/stroom/commit/cdfde2b3f500848be8a51f49affd10f9eebb42c7))
* align kWh right-axis zero with €/kWh left-axis zero ([cc4a9d3](https://github.com/blip456/stroom/commit/cc4a9d30d2e1164f8ecd2f0a0daeb100a3ff4bf9))
* any tap clears pinned bar selection ([6c10e04](https://github.com/blip456/stroom/commit/6c10e04d8a8f1803b41602bd85804d52adc826a5))
* change threshold increment from 5¢ to 1¢ per tap ([06175ad](https://github.com/blip456/stroom/commit/06175ad8a61b81057cdf46661b91172049337ae2))
* **chart:** anchor kWh line baseline at the €0 gridline when prices go negative ([07344a5](https://github.com/blip456/stroom/commit/07344a56caedee800b708ead906d284df14d7e23))
* **chart:** clear hover highlight when the pointer leaves the chart ([0c9cb4a](https://github.com/blip456/stroom/commit/0c9cb4a64dc1d459b24c6ea34485b0073ec6b7af))
* **ci:** restore git credentials for semantic-release push ([63e901b](https://github.com/blip456/stroom/commit/63e901b3400f733462ba78cd34f49e0afa66f448))
* **ci:** restore git credentials for semantic-release push ([4fcf873](https://github.com/blip456/stroom/commit/4fcf8732859df6eb290354673bc7a7bd73681815))
* dark mode amber cards + better import feedback + BOM handling ([d17a3d0](https://github.com/blip456/stroom/commit/d17a3d0156a91c3d49efcbbb37ce547815cd0014))
* detect and reject dagtotalen files with a clear error message ([c4e2dcf](https://github.com/blip456/stroom/commit/c4e2dcf9f92383f67301cf1750e1200bdb68916f))
* detect tap by counting bars visited, not pixel distance ([3dbdead](https://github.com/blip456/stroom/commit/3dbdead850161a0f1788af031e942224ce07dcbf))
* improve dark mode contrast on meter data loaded card ([c567efb](https://github.com/blip456/stroom/commit/c567efb27e873b41bb2d86e02e2863729a59a195))
* infinite reactive loop causing duplicate charts; clean up period overview ([aad1f55](https://github.com/blip456/stroom/commit/aad1f55c978757f11cca23ccccc981307b964053))
* **parser:** include fileType in empty-file parse result ([112edee](https://github.com/blip456/stroom/commit/112edee3933598e29a705109c957b6d06089a2b2))
* **release:** point repository URL at the renamed stroom repo ([669b8e0](https://github.com/blip456/stroom/commit/669b8e0b8d6725eb26204a277027e7da1a7317ed))
* reliable bar deselect on tap and click-outside ([ecf30ab](https://github.com/blip456/stroom/commit/ecf30ab7bf548de055c14622de35bcf148f71900))
* reliable iOS tap detection via touchstart bar capture ([fe60d23](https://github.com/blip456/stroom/commit/fe60d23c5378e16469bb728ad7b23dba66884acc))
* reliable touch bar selection in PriceChart ([b3ac546](https://github.com/blip456/stroom/commit/b3ac546392f7653ec19e9ad999680fd765df9bf3))
* remove dark mode variants from meter data card (app is light-only) ([74e1acb](https://github.com/blip456/stroom/commit/74e1acba4961ff1b6e3297c2614e04a0c803dfb5))
* replace Chart.js onClick with native touch events for iOS tap ([89e3f5a](https://github.com/blip456/stroom/commit/89e3f5ac9abd91f3e72a6f1279d736d1f420b5a8))
* replace getElementsAtEventForMode with pixel math for iOS tap detection ([8cd74d0](https://github.com/blip456/stroom/commit/8cd74d013b49050e6e16ce1121711f8c6a20a187))
* resolve 500 error — SSR window crash and dead API sources ([2031ba0](https://github.com/blip456/stroom/commit/2031ba09f174d7e1f0898be15b42b14d7bd70294))
* restore original nav layout so forward arrow stays at far right ([5442032](https://github.com/blip456/stroom/commit/5442032047e17910219e3a66c91e8498cafdae35))
* restore working iOS touch handling from commit b3ac546 ([6f334f1](https://github.com/blip456/stroom/commit/6f334f138ce4916037669b9bf0ad15eb9ad642ec))
* **stats:** rename marktgemiddelde to gemiddelde uurprijs ([ec4aa46](https://github.com/blip456/stroom/commit/ec4aa4655708374565660b627df9f43553b83250))
