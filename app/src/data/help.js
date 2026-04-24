/**
 * ImageChef — Help Data Integrator
 *
 * Slurps all markdown files from /public/help directly into the client bundle 
 * for instantaneous memory-based searching and loading without network latency.
 */

// Load all .md files synchronously from public/help/
const rawMarkdownFiles = import.meta.glob('/public/help/*.md', { query: '?raw', eager: true });

// Pre-parse the catalog into memory instantly
export const helpCatalog = Object.keys(rawMarkdownFiles).map(path => {
  // Extract id from path (e.g. "/public/help/geo-crop.md" -> "geo-crop")
  const id = path.split('/').pop().replace('.md', '');
  const rawContent = rawMarkdownFiles[path].default || rawMarkdownFiles[path];
  
  // Very simplistic front-matter parser to extract tags (e.g. `--- \n tags: [video, audio] \n ---`)
  let tags = ['general'];
  let title = id;
  let body = rawContent;
  
  const matterMatch = rawContent.match(/^---\n([\s\S]*?)\n---/);
  if (matterMatch) {
    body = rawContent.slice(matterMatch[0].length).trim();
    const tagsMatch = matterMatch[1].match(/tags:\s*\[(.*?)\]/);
    if (tagsMatch) {
      tags = tagsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  // Attempt to grab the first H1 for the title natively
  const h1Match = body.match(/^#\s+(.*)/m);
  if (h1Match) title = h1Match[1].trim();

  return {
    id,
    title,
    tags,
    body,      // Raw markdown (without frontmatter)
    rawContent // Entire file (for index matching)
  };
});

/** Retrieves a specific help definition */
export function getHelpRecord(id) {
  return helpCatalog.find(h => h.id === id) || null;
}
