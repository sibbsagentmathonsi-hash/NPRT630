# Fix Log

## 2026-10-08

### Repository publish and cleanup

- Confirmed the GitHub remote is `https://github.com/sibbsagentmathonsi-hash/NPRT630.git`.
- Synced local `main` with `origin/main` before publishing new changes.
- Resolved the root `README.md` conflict after the repository layout changed from `PROJECT/Code` to `Code`.
- Published the repository update to GitHub at commit `f84a9fb` (`Update project README`).
- Left generated/local artifacts untracked and unpublished:
  - `PROJECT.zip`
  - `PROJECT/`

### Project verification

- Installed project dependencies in the tracked `Code/` workspace with `npm.cmd install`.
- Verified the production build with `npm.cmd run build`.
- Verified backend tests with `npm.cmd test --workspace backend`.
- Test result: 49 passing tests, 0 failing tests.

### AWS deployment investigation

- Confirmed the older AWS site responded at `http://13.60.191.67`.
- Confirmed `/api/health` returned `status: ok` from the running API.
- Identified that SSH access, not the application code, was the deployment blocker.
- Confirmed Amazon Linux 2023 should use `ec2-user` as the SSH username.
- Confirmed the provided key fingerprint:
  - `SHA256:qyYCvDujLogTsTdfSCsIJaAmzsT4IPf4zWNc2/IRz6E`
- Confirmed the provided private key was rejected by the EC2 instance, so it does not match the active instance key pair.
- Confirmed the replacement EC2 instance at `13.53.117.124` also requires the correct new private key before deployment can continue.

### Current deployment status

- GitHub is current with the tracked project.
- The AWS update is pending correct SSH access to the new EC2 instance.
- Required next input: the private key file path for the new instance key pair.
