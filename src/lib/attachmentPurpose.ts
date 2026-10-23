/** Keep existing attachments as deliveries; only the explicit references folder is reference material. */
export function isReferenceAttachment(fileUrl: string): boolean {
  const path = fileUrl.match(/\/task-attachments\/([^?#]+)/)?.[1] ?? fileUrl.split(/[?#]/)[0];
  try {
    return /^[^/]+\/references\/[^/]+$/.test(decodeURIComponent(path));
  } catch {
    return false;
  }
}