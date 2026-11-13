#!/usr/bin/env node
// Generates illustration-style SVG cards (stats, languages, streak, trophies)
// from live GitHub data and wraps the contribution snake in a warm frame.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const USER = "livelyfun";
const PROFILE_REPO = USER + "/" + USER;
const DIST = process.env.DIST || "dist";
const FONT = "Segoe UI, Helvetica, Arial, sans-serif";

function mock(args) {
  const first = args[0];
  if (first.startsWith("graphql")) {
    const daysList = [];
    for (let i = 0; i < 365; i++) {
      const d = new Date(Date.now() - (364 - i) * 86400000).toISOString().slice(0, 10);
      daysList.push({ date: d, contributionCount: i > 330 || i % 5 !== 0 ? (i * 7) % 6 : 0 });
    }
    return { data: { user: {
      contributionsCollection: { totalCommitContributions: 412, contributionCalendar: { totalContributions: 538, weeks: [{ contributionDays: daysList }] } },
      pullRequests: { totalCount: 6 }, issues: { totalCount: 2 } } } };
  }
  if (first.endsWith("/languages")) {
    return first.includes("/r0/") ? { TypeScript: 45200, Python: 16500, C: 10000, "C#": 6700, CSS: 6200, JavaScript: 6000, Kotlin: 4800, HTML: 4600 } : {};
  }
  if (first.includes("/repos")) {
    return Array.from({ length: 19 }, (_, i) => ({ visibility: "public", fork: false, archived: false, full_name: USER + "/r" + i, stargazers_count: i < 7 ? 1 : 0 }));
  }
  return { followers: 35 };
}

function gh(args) {
  if (process.env.CARDS_MOCK === "1") return mock(args);
  const out = execFileSync("gh", ["api", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}

const esc = (v) =>
  String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const DEFS = `<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFF5EB"/><stop offset="100%" stop-color="#FFE4C9"/></linearGradient>
<linearGradient id="txt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2D2A26"/><stop offset="1" stop-color="#5A5048"/></linearGradient>
</defs>`;

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${DEFS}${body}</svg>`;

function bg(w, h, blobs = [], rx = 28) {
  let o = `<rect width="${w}" height="${h}" rx="${rx}" fill="url(#bg)"/>`;
  for (const [cx, cy, r, color, op] of blobs) {
    o += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}"/>`;
  }
  return o;
}

const card = (x, y, w, h, rx = 22) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#FFFFFF" stroke="#F0D9C0" stroke-width="2"/>`;

const t = (x, y, text, size = 15, weight = 400, fill = "#5A5048", anchor = "start") =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(text)}</text>`;

const nf = (n) => (n == null ? "-" : Number(n).toLocaleString("en-US"));

function write(name, content) {
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, name), content, "utf8");
}

const user = gh(["users/" + USER]);
const allRepos = gh(["users/" + USER + "/repos?per_page=100&type=owner"]);
const repos = allRepos.filter((r) => r.visibility === "public" && !r.fork && !r.archived && r.full_name !== PROFILE_REPO);

const stars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);

const langTotals = new Map();
for (const r of repos) {
  const langs = gh(["repos/" + r.full_name + "/languages"]);
  for (const [name, bytes] of Object.entries(langs)) langTotals.set(name, (langTotals.get(name) || 0) + bytes);
}
const langs = [...langTotals.entries()].sort((a, b) => b[1] - a[1]);
const langSum = langs.reduce((s, e) => s + e[1], 0) || 1;

let commits = null, prs = null, issues = null, days = [], yearTotal = null;
try {
  const q = `query($login:String!){user(login:$login){
    contributionsCollection{ totalCommitContributions
      contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } } }
    pullRequests{ totalCount } issues{ totalCount } } }`;
  const res = gh(["graphql", "-f", "query=" + q, "-F", "login=" + USER]);
  const u = res.data.user;
  commits = u.contributionsCollection.totalCommitContributions;
  prs = u.pullRequests.totalCount;
  issues = u.issues.totalCount;
  yearTotal = u.contributionsCollection.contributionCalendar.totalContributions;
  days = u.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .sort((a, b) => a.date.localeCompare(b.date));
} catch (e) {
  console.warn("GraphQL data unavailable, continuing with REST data only:", e.message);
}

function streaks(list) {
  let longest = 0, run = 0;
  for (const d of list) {
    run = d.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let i = list.length - 1;
  if (i >= 0 && list[i].contributionCount === 0) i--;
  let current = 0;
  for (; i >= 0 && list[i].contributionCount > 0; i--) current++;
  return { current, longest };
}
const { current, longest } = streaks(days);

const LANG_COLORS = {
  TypeScript: "#6C9BCF", Python: "#7CB67C", JavaScript: "#E8B86D", "C#": "#C9A0DC", C: "#A0AEC0",
  CSS: "#E8A0BF", HTML: "#E8956F", Kotlin: "#9B8AC4", Java: "#D4A574", Shell: "#88C070",
  Dockerfile: "#7BA3C9", PLpgSQL: "#6BB8C9", Go: "#6BB5B0", Rust: "#D4A06A",
};
const FALLBACK = ["#E8A0A0", "#A8D5E5", "#B5EAD7", "#FFDAC1", "#C7CEEA", "#FFE8D6"];
const langColor = (name, i) => LANG_COLORS[name] || FALLBACK[i % FALLBACK.length];

{
  const W = 420, H = 270;
  let b = bg(W, H, [[60, 40, 50, "#FFD6A5", 0.45], [380, 230, 60, "#FFADC6", 0.3]], 26);
  b += card(14, 14, W - 28, H - 28, 20);
  b += t(40, 52, "GitHub stats", 20, 700, "#2D2A26");
  const rows = [
    ["Total stars", stars, "#E8B86D"],
    ["Commits (last year)", commits, "#6C9BCF"],
    ["Pull requests", prs, "#7CB67C"],
    ["Issues", issues, "#E8A0BF"],
    ["Public repos", repos.length, "#A8D5E5"],
    ["Followers", user.followers, "#C9A0DC"],
  ];
  rows.forEach(([label, value, color], i) => {
    const y = 96 + i * 28;
    b += `<circle cx="46" cy="${y - 5}" r="4" fill="${color}"/>`;
    b += t(60, y, label, 15, 400, "#5A5048");
    b += t(W - 40, y, nf(value), 16, 700, "#2D2A26", "end");
  });
  write("stats.svg", svg(W, H, b, "GitHub stats"));
}

{
  const W = 420, H = 270;
  let b = bg(W, H, [[360, 40, 50, "#B8E0D2", 0.4], [50, 230, 55, "#FFD6A5", 0.35]], 26);
  b += card(14, 14, W - 28, H - 28, 20);
  b += t(40, 52, "Top languages", 20, 700, "#2D2A26");
  const top = langs.slice(0, 6);
  const barX = 40, barW = W - 80;
  b += `<clipPath id="bar"><rect x="${barX}" y="72" width="${barW}" height="10" rx="5"/></clipPath><g clip-path="url(#bar)">`;
  b += `<rect x="${barX}" y="72" width="${barW}" height="10" fill="#F0D9C0"/>`;
  let x = barX;
  top.forEach(([name, bytes], i) => {
    const w = (bytes / langSum) * barW;
    b += `<rect x="${x.toFixed(2)}" y="72" width="${w.toFixed(2)}" height="10" fill="${langColor(name, i)}"/>`;
    x += w;
  });
  b += "</g>";
  top.forEach(([name, bytes], i) => {
    const y = 114 + i * 24;
    b += `<circle cx="46" cy="${y - 5}" r="5" fill="${langColor(name, i)}"/>`;
    b += t(60, y, name, 15, 400, "#5A5048");
    b += t(W - 40, y, ((bytes / langSum) * 100).toFixed(1) + "%", 14, 600, "#6B5E54", "end");
  });
  if (!top.length) b += t(40, 120, "No language data yet", 15, 400, "#5A5048");
  write("languages.svg", svg(W, H, b, "Top languages"));
}

{
  const W = 900, H = 180;
  let b = bg(W, H, [[100, 40, 60, "#FFD6A5", 0.4], [800, 140, 70, "#FFADC6", 0.3], [450, 30, 40, "#B8E0D2", 0.35]], 26);
  b += card(30, 26, 840, 128, 22);
  const cols = [
    [190, nf(yearTotal), "Contributions in the last year"],
    [450, nf(current) + (days.length ? " days" : ""), "Current streak"],
    [710, nf(longest) + (days.length ? " days" : ""), "Longest streak"],
  ];
  cols.forEach(([cx, big, label], i) => {
    b += t(cx, 94, big, 36, 700, "#2D2A26", "middle");
    b += t(cx, 124, label, 14, 400, "#6B5E54", "middle");
    if (i < 2) b += `<line x1="${cx + 130}" y1="60" x2="${cx + 130}" y2="124" stroke="#F0D9C0" stroke-width="1.5"/>`;
  });
  write("streak.svg", svg(W, H, b, "Contribution streak"));
}

{
  const W = 900, H = 240;
  let b = bg(W, H, [[80, 40, 55, "#C9A0DC", 0.35], [820, 200, 65, "#A8D5E5", 0.3], [450, 50, 40, "#FFDAC1", 0.35]], 26);
  b += card(30, 30, 840, 180, 22);
  b += t(64, 68, "Trophies", 22, 700, "#2D2A26");
  const RANK = [["-", "#A0AEC0"], ["C", "#6C9BCF"], ["B", "#7CB67C"], ["A", "#E8B86D"], ["S", "#E8A0BF"]];
  const metrics = [
    ["Stars", stars, [1, 5, 15, 50]],
    ["Commits", commits, [10, 100, 500, 1500]],
    ["Followers", user.followers, [1, 10, 30, 100]],
    ["Repos", repos.length, [1, 10, 25, 50]],
    ["Pull requests", prs, [1, 10, 30, 100]],
    ["Issues", issues, [1, 5, 20, 50]],
    ["Languages", langs.length, [1, 3, 6, 10]],
  ];
  const tileW = 104, gap = 8;
  const startX = (W - (metrics.length * tileW + (metrics.length - 1) * gap)) / 2;
  metrics.forEach(([label, value, th], i) => {
    const x = startX + i * (tileW + gap), cx = x + tileW / 2;
    const rank = th.filter((n) => (value || 0) >= n).length;
    const [letter, color] = RANK[rank];
    b += `<rect x="${x}" y="86" width="${tileW}" height="108" rx="14" fill="#FFF8F0" stroke="#F0D9C0" stroke-width="1.5"/>`;
    b += `<g transform="translate(${cx - 21.6} 98) scale(1.8)" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">`
      + `<path d="M7 3h10v6a5 5 0 0 1-10 0V3z"/><path d="M7 5H4v2a3 3 0 0 0 3 3" fill="none"/><path d="M17 5h3v2a3 3 0 0 1-3 3" fill="none"/>`
      + `<path d="M12 14v4M8 20h8" fill="none"/></g>`;
    b += t(x + tileW - 12, 106, letter, 13, 700, color, "end");
    b += t(cx, 160, label, 13, 700, "#2D2A26", "middle");
    b += t(cx, 180, nf(value), 13, 400, "#6B5E54", "middle");
  });
  write("trophies.svg", svg(W, H, b, "Trophies"));
}

const snakePath = path.join(DIST, "github-snake.svg");
if (fs.existsSync(snakePath)) {
  let s = fs.readFileSync(snakePath, "utf8");
  const m = s.match(/viewBox="\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  if (m && !s.includes('id="gl-bg"')) {
    const [vx, vy, vw, vh] = m.slice(1).map(Number);
    const pad = 28;
    const nx = vx - pad, ny = vy - pad, nw = vw + pad * 2, nh = vh + pad * 2;
    s = s.replace(m[0], `viewBox="${nx} ${ny} ${nw} ${nh}"`);
    s = s.replace(/(<svg[^>]*?)\swidth="[\d.]+"/, `$1 width="${nw}"`).replace(/(<svg[^>]*?)\sheight="[\d.]+"/, `$1 height="${nh}"`);
    const open = s.match(/^[\s\S]*?<svg[^>]*>/)[0];
    const frame =
      `<defs>`
      + `<linearGradient id="gl-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFF5EB"/><stop offset="100%" stop-color="#FFE4C9"/></linearGradient>`
      + `<clipPath id="gl-clip"><rect x="${nx}" y="${ny}" width="${nw}" height="${nh}" rx="26"/></clipPath></defs>`
      + `<rect x="${nx}" y="${ny}" width="${nw}" height="${nh}" rx="26" fill="url(#gl-bg)"/>`
      + `<circle cx="${nx + nw * 0.1}" cy="${ny + nh * 0.25}" r="${nh * 0.35}" fill="#FFD6A5" opacity="0.45"/>`
      + `<circle cx="${nx + nw * 0.9}" cy="${ny + nh * 0.8}" r="${nh * 0.4}" fill="#FFADC6" opacity="0.3"/>`
      + `<rect x="${nx + 10}" y="${ny + 10}" width="${nw - 20}" height="${nh - 20}" rx="20" fill="#FFFFFF" stroke="#F0D9C0" stroke-width="2"/>`;
    s = open + frame + s.slice(open.length);
    fs.writeFileSync(snakePath, s, "utf8");
    console.log("Snake framed.");
  }
}

console.log("Cards generated in " + DIST + ": stats " + stars + " stars, " + repos.length + " repos, " + langs.length + " languages.");
