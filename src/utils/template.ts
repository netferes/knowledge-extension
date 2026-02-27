export function defaultMarkdownTemplate(title: string): string {
  const createdAt = new Date().toISOString();
  return `# ${title}

Created: ${createdAt}

## Summary

- 

## Details

`;
}
