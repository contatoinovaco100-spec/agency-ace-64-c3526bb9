import { describe, expect, it } from 'vitest';
import { isReferenceAttachment } from './attachmentPurpose';

describe('art attachment separation', () => {
  it('identifies uploaded references in public, signed and plain storage paths', () => {
    for (const url of [
      'task-id/references/sample.png',
      'https://storage.example/storage/v1/object/public/task-attachments/task-id/references/sample.png',
      'https://storage.example/storage/v1/object/sign/task-attachments/task-id/references/sample.pdf?token=x',
    ]) expect(isReferenceAttachment(url)).toBe(true);
  });
  it('keeps existing final files separate, even when named references', () => {
    expect(isReferenceAttachment('https://storage.example/storage/v1/object/public/task-attachments/task-id/references.png')).toBe(false);
    expect(isReferenceAttachment('task-id/final.png')).toBe(false);
    expect(isReferenceAttachment('https://instagram.com/references/example')).toBe(false);
  });
});