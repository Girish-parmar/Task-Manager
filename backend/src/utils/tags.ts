export function tagList(tags: { tag: string }[]): string[] {
  return tags.map((t) => t.tag);
}
