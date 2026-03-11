const NEWS_FEEDS = [
  "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  "https://feeds.bbci.co.uk/news/rss.xml",
  "http://feeds.reuters.com/reuters/topNews",
  "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
  "https://feeds.npr.org/1001/rss.xml",
  "https://feeds.apnews.com/rss/apf-topnews.rss", 
  "https://www.theguardian.com/world/rss",
  "https://thehill.com/news/feed",
  "https://www.cbsnews.com/latest/rss/main",
  "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  "https://www.ft.com/rss/home",
  "https://www.axios.com/feed",
  "https://rss.slashdot.org/Slashdot/slashdotMain"
];

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(generateDailyPage(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const targetDate = dateParam || todayStr;
    const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().split('T')[0];

    if (url.pathname === "/robots.txt") {
      const robots = `# Good neighbors are welcome
User-agent: Googlebot
Allow: /
User-agent: Bingbot
Allow: /
User-agent: DuckDuckBot
Allow: /

# Keep off the grass
User-agent: Baiduspider
Disallow: /
User-agent: YandexBot
Disallow: /
User-agent: Bytespider
Disallow: /
User-agent: PetalBot
Disallow: /
User-agent: Sogou web spider
Disallow: /
User-agent: 360Spider
Disallow: /
User-agent: YisouSpider
Disallow: /
User-agent: Mail.RU_Bot
Disallow: /

# General admission
User-agent: *
Allow: /
`.trim();
      return new Response(robots, { headers: { "Content-Type": "text/plain" } });
    }

    if (url.pathname === "/text") {
      const lookupTKey = dateParam ? `text_${dateParam}` : "text_live";
      const text = await env.CONTENT_KV.get(lookupTKey);
      if (!text) return new Response("Note not found.", { status: 404 });
      return new Response(text, {
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    if (url.pathname === "/archive") {
      return await renderArchiveList(env);
    }
    
    const lookupFKey = dateParam ? `note_${dateParam}` : "note_live";
    const html = await env.CONTENT_KV.get(lookupFKey);

    if (!html) {
      return new Response("Note not found for this date. Go grab a coffee and try again later.", { status: 404 });
    }

    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }
};

async function generateDailyPage(env) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const dayOfMonth = now.getDate();
  let allHeadlines = [];
  for (const url of NEWS_FEEDS) {
    try {
      const response = await fetch(url, {headers: { "User-Agent": "Mozilla/5.0 (compatible; TodayFeelsLikeBot/1.0)" }});
      const text = await response.text();
      const titles = [...text.matchAll(/<title>(.*?)<\/title>/g)]
        .map(m => m[1])
        .slice(1, 5); // Take top 4 from each
      allHeadlines.push(...titles);
    } catch (e) { console.error(`Failed ${url}`); }
  }

  const context = allHeadlines.join(". ");
// buckle up for this roller coaster of context
  const promptAsk = `CONTEXT: You are a witty, slightly cynical, but grounded, liberal midwest American millenial who has lived through several doomsday scenarios and are feeling unphased by the next one. You are writing daily content for https://todayfeelslike.com
  TASK: Review these headlines: ${context.substring(0, 3000)}.
  RULES:
  1. Provide a 3 sentence summary of "how today feels" to a regular person, while being conversational, 
  using a touch of dry humor, keeping it relatable, and having a tone of dark optimism.
  2. Sentence 1: The setup (what's happening in the world), be specific, call out big headlines, no analogies or idioms.
  3. Sentence 2: The reaction (your context's perspective), dry humor, conversational, no analogies or idioms.
  4. Sentence 3: The Punchline. This must include a wild, obscure and completely original analogy or 'new idiom'.
      - Avoid known cliches like "needle in a haystack"
      - Use unrelatable imagery mixing: hardware tools, regional fast food, obscure car parts, HOA meeting topics, 1980s high school classes, biology exam questions, etc.
      - Example: "Today feels like trying to jump-start a riding mower with a 9-volt battery and a prayer."
      - Example: "It's like finding a devilled egg in a communal office fridge—confusing, dangerous, and someone is definitely getting fired."
      - Example: "Today feels like trying to explain a touch-screen soda machine to a man who still carries a checkbook."
  5. Avoid using any special characters or syntax that would break HTML formatting.
  6. No prefixed or suffixed comments! Do not say "Here is your", or "Note: ". Output only the 3 sentences as a conversational reply to the question "How does it feel today?".
  7. Again DO NOT UNDER ANY CIRCUMSTANCE Include a comment like 'Note:' or 'Heres my'.`;

  const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct", { prompt: promptAsk, temperature: 0.4 });

  const summary = aiResponse.response.trim();
  const sentenceMatch = summary.match(/[^.!?]+[.!?]\s*$/g);
  const lastSentence = sentenceMatch ? sentenceMatch[0].trim() : "..like a lot";
  const htmlLS = lastSentence.replace(/"/g, "'");
  await env.CONTENT_KV.put(`text_${todayStr}`, summary);
  await env.CONTENT_KV.put(`text_live`, summary);

  const favicon = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect x=%2210%22 y=%2220%22 width=%2280%22 height=%2270%22 rx=%2210%22 fill=%22%23222%22/><rect x=%2210%22 y=%2220%22 width=%2280%22 height=%2220%22 rx=%225%22 fill=%22%23d32f2f%22/><text x=%2250%22 y=%2280%22 font-family=%22Arial%22 font-weight=%22bold%22 font-size=%2250%22 fill=%22white%22 text-anchor=%22middle%22>${dayOfMonth}</text></svg>`;

  const finalHtml = `
    <!DOCTYPE html>
    <html lang="en" data-theme="dark">
    <head>
      <meta charset="UTF-8"><title>Today Feels Like - ${todayStr}</title>

      <meta property="og:title" content="Today Feels Like...">
      <meta property="og:description" content="${htmlLS}">
      <meta property="og:type" content="website">
      <meta property="og:url" content="https://todayfeelslike.com">

      <link rel="icon" href="${favicon}">
      <style>
:root { --bg: #1a1a1a; --card: #2d2d2d; --text: #e0e0e0; --accent: #888; --border: #444; }
        [data-theme="light"] { --bg: #f4f1ea; --card: #ffffff; --text: #333333; --accent: #666; --border: #ddd; }
        
        body { font-family: 'Georgia', serif; background: var(--bg); color: var(--text); display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; transition: 0.3s; flex-direction: column; }
        .card { max-width: 500px; width: 90%; padding: 2.5rem; border: 1px solid var(--border); background: var(--card); box-shadow: 12px 12px 0px var(--border); margin-bottom: 2rem; }
        h1 { font-size: 1rem; text-transform: uppercase; letter-spacing: 3px; border-bottom: 2px solid var(--text); padding-bottom: 0.5rem; margin-top: 0; }
        p { font-size: 1.6rem; line-height: 1.5; font-style: italic; margin: 1.5rem 0; }
        .meta { display: flex; justify-content: space-between; align-items: center; color: var(--accent); font-size: 0.8rem; }
        nav { display: flex; gap: 20px; font-family: sans-serif; font-size: 0.9rem; }
        a { color: var(--accent); text-decoration: none; border-bottom: 1px solid var(--border); cursor: pointer; }
        button { background: none; border: 1px solid var(--border); color: var(--text); padding: 5px 10px; cursor: pointer; font-family: sans-serif; }
        a.archive { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); font-family: sans-serif; font-size: 0.7rem; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); opacity: 0.3; text-decoration: none; transition: opacity 0.3s ease;}
        a.archive:hover { opacity: 1;}
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Today feels like...</h1>
        <p>"${summary}"</p>
        <div class="meta">
          <span>Updated: ${new Date().toLocaleDateString('en-US')}</span>
          <button onclick="toggleTheme()" id="t-btn">Switch to Light</button>
        </div>
      </div>
      <a href="/archive" class="archive">How did it used to feel?</a>
    <script>
        function toggleTheme() {
          const html = document.documentElement;
          const btn = document.getElementById('t-btn');
          if (html.getAttribute('data-theme') === 'dark') {
            html.setAttribute('data-theme', 'light');
            btn.innerText = 'Switch to Dark';
          } else {
            html.setAttribute('data-theme', 'dark');
            btn.innerText = 'Switch to Light';
          }
        }
    </script>
    </body>
    </html>`;

  await env.CONTENT_KV.put(`note_${todayStr}`, finalHtml);
  await env.CONTENT_KV.put(`note_live`, finalHtml);
}

async function renderArchiveList(env) {
  const list = await env.CONTENT_KV.list({ prefix: "note_2" });
  const links = list.keys.sort().reverse().map(key => {
    const date = key.name.replace("note_", "");
    return `<li><a href="/?date=${date}">${date}</a></li>`;
  }).join("");

  return new Response(`
    <html>
      <body style="font-family: Georgia, serif; padding: 50px; background: #1a1a1a; color: #e0e0e0;">
        <h2>What did it feel like?</h2>
        <ul style="line-height: 2;">${links}</ul>
        <br><a href="/" style="color: #888; text-decoration: none;">Today</a>
      </body>
    </html>`, { headers: { "Content-Type": "text/html" } });
}
