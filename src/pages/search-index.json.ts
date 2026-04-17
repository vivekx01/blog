import { getCollection } from "astro:content";

export async function GET() {
  const posts = (await getCollection("blog"))
    .filter(post => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const index = posts.map(post => {
    const parts = post.slug.split("/");
    let category = "General";
    if (parts[0] === "technical" && parts.length >= 3) {
      const s = parts[1];
      category = s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
    } else if (parts[0] === "life-experiences") {
      category = "Life Experiences";
    }

    return {
      title: post.data.title,
      description: post.data.description,
      href: `/${post.collection}/${post.slug}`,
      category,
      date: post.data.date.toISOString().split("T")[0],
    };
  });

  return new Response(JSON.stringify(index), {
    headers: { "Content-Type": "application/json" },
  });
}
