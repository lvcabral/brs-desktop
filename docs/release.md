# How to Create a Release

## Process

- Checkout the `master` branch and run `git pull`
- Edit `package.json` and bump the version
- Make sure the `CHANGELOG.md` file is updated with the version changes
- Create the annotated tag with the version: `git tag -a v1.x.x`
- Push the updates with the tag: `git push --follow-tags`
- The GitHub Actions workflow will be triggered and create a Draft release with installers.

## Local Package Build

- Open `build/notarize.mac.js` and uncomment the line `require('dotenv').config();`
- Create a `.env` file in the root folder with the following variables:
- APPLE_ID=<your_apple_id>
- APPLE_TEAM_ID=<your_apple_team_id>
- APPLE_PASSWORD=<your_apple_password>
- Run `npm run release` to build the code
- Run `npm run dist` to create the installers and notarize the macOS app
- The installers will be created in the `dist` folder
- After the build, comment back the line in `build/notarize.mac.js` to avoid exposing your Apple ID in the repository.
