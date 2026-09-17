const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(
    `JazzTow needs Node 22.13+ (24 recommended). This shell is Node ${process.version}.`,
  );
  console.error('Switch with: nvm install 24 && nvm use');
  process.exit(1);
}
