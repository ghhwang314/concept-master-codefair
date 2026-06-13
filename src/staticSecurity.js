export function isSafeStaticPath(relativePath) {
  return relativePath
    .split(/[\\/]+/)
    .every((part) => part && part !== ".." && !part.startsWith("."));
}
