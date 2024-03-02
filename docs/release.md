# How to Create a Release

## Process

- Checkout the `master` branch and run `git pull`
- Edit `package.json` and bump the version
- Make sure the `CHANGELOG.md` file is updated with the version changes
- Create the annotated tag with the version: `git tag -a v1.x.x`
- Push the updates with the tag: `git push --follow-tags`
- The GitHub Actions workflow will be triggered and create a Draft release with installers.


