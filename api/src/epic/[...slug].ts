
interface SlugParams {
  params: { '*': string };
  path: string;
  query: Record<string, string>;
}

export const get = ({ params, path, query }: SlugParams) => {
  // Get the catch-all slug
  const slug = params['*'] || '';
  const segments = slug.split('/').filter(Boolean);
  
  // Example: Handle blog post structure /posts/year/month/title
  if (segments.length === 3) {
    const [year, month, title] = segments;
    return {
      type: "blog-post",
      year,
      month,
      title,
      fullSlug: slug,
      query
    };
  }
  
  // Example: Handle category structure /posts/category/subcategory
  if (segments.length === 2) {
    const [category, subcategory] = segments;
    return {
      type: "category",
      category,
      subcategory,
      fullSlug: slug
    };
  }
  
  // Default response
  return {
    message: "Posts catch-all route",
    slug,
    segments,
    fullPath: path,
    examples: [
      "/posts/2024/12/my-article",
      "/posts/tech/typescript",
      "/posts/tutorials"
    ]
  };
};