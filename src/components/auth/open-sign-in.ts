const signInOpeners = new Set<() => void>();

export function openSignInDialog() {
  for (const open of signInOpeners) open();
}

export function registerSignInOpener(open: () => void) {
  signInOpeners.add(open);
  return () => {
    signInOpeners.delete(open);
  };
}
