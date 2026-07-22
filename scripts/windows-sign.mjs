import { execFileSync } from 'node:child_process';

/**
 * electron-builder's win.signtoolOptions.sign hook (electron-builder.yml) —
 * invoked once per file that needs an Authenticode signature: the main exe,
 * the NSIS uninstaller, elevate.exe, and the final setup.exe.
 *
 * Why not the built-in signtool.exe + CSC_LINK flow: since June 1, 2023, the
 * CA/Browser Forum's baseline requirements mandate that every publicly
 * trusted code-signing certificate's private key be generated and stored
 * non-exportable on a FIPS-140-2-level-2+ hardware token or HSM. No public
 * CA can issue an exportable .pfx for a fresh certificate anymore, so
 * CSC_LINK (which expects a .pfx on disk) is a dead end here — this instead
 * shells out to SSL.com's CodeSignTool, which signs remotely against their
 * cloud HSM. No physical token to plug into a GitHub Actions runner.
 *
 * Inert by design: with no ES_USERNAME set, this is a no-op and the build
 * stays unsigned exactly as before — nothing breaks for a contributor (or
 * CI) without SSL.com credentials configured.
 */
export default async function sign(configuration) {
  if (!process.env.ES_USERNAME) return;

  const codeSignToolPath = process.env.CODESIGNTOOL_PATH;
  if (!codeSignToolPath) {
    throw new Error(
      'ES_USERNAME is set but CODESIGNTOOL_PATH is not — point it at your unzipped CodeSignTool install (see CONTRIBUTING.md).',
    );
  }

  const args = [
    'sign',
    `-username=${process.env.ES_USERNAME}`,
    `-password=${process.env.ES_PASSWORD}`,
    `-input_file_path=${configuration.path}`,
  ];
  if (process.env.ES_CREDENTIAL_ID) args.push(`-credential_id=${process.env.ES_CREDENTIAL_ID}`);
  if (process.env.ES_TOTP_SECRET) args.push(`-totp_secret=${process.env.ES_TOTP_SECRET}`);

  // No -output_dir_path: CodeSignTool overwrites configuration.path in
  // place, which is exactly what electron-builder expects this hook to do.
  execFileSync(`${codeSignToolPath}/CodeSignTool.bat`, args, { stdio: 'inherit' });
}
