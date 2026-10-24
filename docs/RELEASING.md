# Releasing (maintainers)

The package is published to npm by GitHub Actions when a version tag is pushed. Never publish by hand with `npm publish`.

```bash
# 1. In a pull request: bump the version and add the release notes
npm version minor --no-git-tag-version      # or patch / major; edits package.json and package-lock.json
#    then move the "Unreleased" entries of CHANGELOG.md under the new version heading

# 2. After the pull request is merged, tag the merge commit and push the tag
git checkout main && git pull
git tag v$(node -p "require('./package.json').version")
git push origin --tags
```

Alternatively, bump and tag locally in one go with `npm version patch` (creates the commit and the tag) and `git push origin main --follow-tags`.

The release notes live in [CHANGELOG.md](../CHANGELOG.md). Pushing the tag is also what makes the GitHub Action reference `manojmallick/copilot-ci-doctor@vX.Y.Z` (see [github-action](github-action.md)) usable.

The workflow `.github/workflows/publish-npm.yml` then:

- checks that the tag matches the version in `package.json`;
- installs dependencies with `npm ci`;
- runs a sanity check (`node src/cli.js --help`);
- packs the package and shows its contents;
- verifies that the npm auth token is set;
- publishes with provenance (`--provenance --access public`).

`copilot-ci-doctor --version` reads the version from `package.json`, so there is nothing else to update.
