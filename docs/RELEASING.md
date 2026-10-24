# Releasing (maintainers)

The package is published to npm by GitHub Actions when a version tag is pushed. Never publish by hand with `npm publish`.

```bash
# 1. Bump the version in package.json (creates the commit and the v* tag)
npm version patch        # or minor / major

# 2. Push the commit and the tag
git push origin main --follow-tags
```

Before tagging, add the release notes to [CHANGELOG.md](../CHANGELOG.md).

The workflow `.github/workflows/publish-npm.yml` then:

- checks that the tag matches the version in `package.json`;
- installs dependencies with `npm ci`;
- runs a sanity check (`node src/cli.js --help`);
- packs the package and shows its contents;
- verifies that the npm auth token is set;
- publishes with provenance (`--provenance --access public`).

`copilot-ci-doctor --version` reads the version from `package.json`, so there is nothing else to update.
