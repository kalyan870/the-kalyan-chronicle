export function validateSubscriberEmail(rawEmail: string): string | null {
  const trimmed = rawEmail.trim();
  if (!trimmed) {
    return 'Please enter your email address to subscribe.';
  }
  if (trimmed.length > 180) {
    return 'Email address must be 180 characters or fewer.';
  }
  if (/\s/.test(trimmed) || trimmed.includes('..')) {
    return 'Please enter a properly formatted email address (for example, reader@domain.com).';
  }
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex !== trimmed.lastIndexOf('@')) {
    return 'Please enter a properly formatted email address (for example, reader@domain.com).';
  }
  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);
  if (
    localPart.length > 64 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)
  ) {
    return 'Please enter a properly formatted email address (for example, reader@domain.com).';
  }
  const domainPattern =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  const lastDot = domainPart.lastIndexOf('.');
  const tld = lastDot >= 0 ? domainPart.slice(lastDot + 1) : '';
  if (!domainPattern.test(domainPart) || !/^[a-zA-Z]{2,}$/.test(tld)) {
    return 'Please enter a properly formatted email address (for example, reader@domain.com).';
  }
  return null;
}
