export function MapleMark({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src="/yul-ops/jazz-logo.png"
      alt="Jazz"
      className={compact ? 'yul-jazz-logo is-compact' : 'yul-jazz-logo'}
    />
  );
}
