#!/usr/bin/env node

const USERNAME = "livelyfun";
const PROFILE_REPO = USERNAME + "/" + USERNAME;
const API_ROOT = "https://api.github.com";
const AUTO_START = "<!-- AUTO:START -->";
const AUTO_END = "<!-- AUTO:END -->";

const token = process.env.GITHUB_TOKEN || "";

function headers() {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };
}

async function github(path) {
  const response = await fetch(API_ROOT + path, { headers: headers() });
  if (!response.ok) {
    const body = await response.text();
    throw new Error("GitHub API " + response.status + " for " + path + ": " + body.slice(0, 200));
  }
  return response.json();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', """)
    .replaceAll("'", "&#39;");
}

function repoUrl(repo) {
  return "https://github.com/" + repo.full_name;
}

function relativeTime(value) {
  if (!value) return "unknown";
  const diffMs = Date.now() - new Date(value).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return days + " days ago";
  const months = Math.floor(days / 30);
  if (months < 12) return months + " month" + (months === 1 ? "" : "s") + " ago";
  const years = Math.floor(months / 12);
  return years + " year" + (years === 1 ? "" : "s") + " ago";
}

function languageLabel(repo) {
  return repo.language || "Mixed";
}

function badge(label, value, bg) {
  return (
    "https://img.shields.io/badge/" +
    encodeURIComponent(label) +
    "-" +
    encodeURIComponent(String(value)) +
    "-" +
    bg +
    "?style=for-the-badge&labelColor=" +
    bg +
    "&color=" +
    bg
  );
}

function renderRecentProjects(repos) {
  if (repos.length === 0) return "_No public projects found yet._";

  const cells = repos.slice(0, 6).map(function (repo) {
    const description = escapeHtml(
      repo.description || "A project built while learning, experimenting, and shipping."
    );
    const shortDesc =
      description.length > 110 ? description.slice(0, 107) + "…" : description;

    return (
      '<td width="50%" valign="top">\n\n' +
      "### [" +
      escapeHtml(repo.name) +
      "](" +
      repoUrl(repo) +
      ")\n\n" +
      shortDesc +
      "\n\n<sub><b>" +
      escapeHtml(languageLabel(repo)) +
      "</b> · ⭐ " +
      repo.stargazers_count +
      " · Updated " +
      relativeTime(repo.pushed_at) +
      "</sub>\n\n</td>"
    );
  });

  while (cells.length < 6) cells.push('<td width="50%"></td>');

  const rows = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push("<tr>\n" + cells[i] + "\n" + cells[i + 1] + "\n</tr>");
  }
  return "<table>\n" + rows.join("\n") + "\n</table>";
}

function renderLanguages(languageTotals) {
  const entries = Array.from(languageTotals.entries())
    .sort(function (a, b) { return b[1] - a[1]; })
    .slice(0, 8);

  if (!entries.length) return "_Language data is not available yet._";

  const total = entries.reduce(function (sum, entry) { return sum + entry[1]; }, 0);
  const softColors = ["FFE8D6", "E8F5E9", "E3F2FD", "FCE4EC", "FFF3E0", "E8EAF6", "F3E5F5", "E0F2F1"];

  return (
    "<p>\n" +
    entries
      .map(function (entry, i) {
        const name = entry[0];
        const pct = ((entry[1] / total) * 100).toFixed(1);
        const bg = softColors[i % softColors.length];
        return (
          '<img src="' +
          badge(name, pct + "%", bg) +
          '" alt="' +
          escapeHtml(name + " " + pct + "%") +
          '" />'
        );
      })
      .join("\n") +
    "\n</p>"
  );
}

function renderActivity(events) {
  const pushes = events
    .filter(function (event) {
      return event.type === "PushEvent" && event.repo && event.repo.name;
    })
    .slice(0, 5);

  if (!pushes.length) return "_No recent public push activity available._";

  return pushes
    .map(function (event) {
      const rawCommits = event.payload && event.payload.commits;
      const count = Array.isArray(rawCommits) ? rawCommits.length : 1;
      return (
        "- [" +
        escapeHtml(event.repo.name) +
        "](https://github.com/" +
        escapeHtml(event.repo.name) +
        ") — " +
        count +
        " commit" +
        (count === 1 ? "" : "s") +
        " · " +
        relativeTime(event.created_at)
      );
    })
    .join("\n");
}

async function main() {
  const results = await Promise.all([
    github("/users/" + USERNAME),
    github("/users/" + USERNAME + "/repos?per_page=100&type=owner&sort=updated&direction=desc"),
    github("/users/" + USERNAME + "/events/public?per_page=30"),
  ]);

  const user = results[0];
  const repos = results[1];
  const events = results[2];

  const publicRepos = repos
    .filter(function (repo) {
      return !repo.private && !repo.fork && !repo.archived && repo.full_name !== PROFILE_REPO;
    })
    .sort(function (a, b) {
      return new Date(b.pushed_at) - new Date(a.pushed_at);
    });

  const languageTotals = new Map();
  for (const repo of publicRepos.slice(0, 8)) {
    try {
      const languages = await github("/repos/" + repo.full_name + "/languages");
      for (const entry of Object.entries(languages)) {
        languageTotals.set(entry[0], (languageTotals.get(entry[0]) || 0) + entry[1]);
      }
    } catch (e) {
      console.warn("languages skip", repo.full_name);
    }
  }

  const stars = publicRepos.reduce(function (sum, repo) {
    return sum + (repo.stargazers_count || 0);
  }, 0);
  const forks = publicRepos.reduce(function (sum, repo) {
    return sum + (repo.forks_count || 0);
  }, 0);

  const syncedAt = new Date().toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  });

  const generated =
    '<div align="center">\n\n' +
    "### 📊 GitHub Snapshot\n\n" +
    "<p>\n" +
    '<img src="' + badge("Repos", publicRepos.length, "FFE8D6") + '" alt="Repos" />\n' +
    '<img src="' + badge("Stars", stars, "FFF3E0") + '" alt="Stars" />\n' +
    '<img src="' + badge("Forks", forks, "E8F5E9") + '" alt="Forks" />\n' +
    '<img src="' + badge("Followers", user.followers || 0, "FCE4EC") + '" alt="Followers" />\n' +
    "</p>\n\n</div>\n\n" +
    "### 🚀 Recent Projects\n\n" +
    renderRecentProjects(publicRepos) +
    "\n\n" +
    '<div align="center">\n\n' +
    "### 💻 Most Used Languages\n\n" +
    renderLanguages(languageTotals) +
    "\n\n</div>\n\n" +
    "### 🔥 Recent Public Activity\n\n" +
    renderActivity(events) +
    "\n\n" +
    '<div align="center">\n<sub>✦ Generated from public GitHub data · Last sync: ' +
    escapeHtml(syncedAt) +
    " (Asia/Kathmandu)</sub>\n</div>";

  const fs = await import("node:fs/promises");
  const readme = await fs.readFile("README.md", "utf8");

  const start = readme.indexOf(AUTO_START);
  const end = readme.indexOf(AUTO_END);

  if (start === -1 || end === -1 || end < start) {
    throw new Error("README.md is missing AUTO:START / AUTO:END markers.");
  }

  const nextReadme =
    readme.slice(0, start + AUTO_START.length) +
    "\n\n" +
    generated +
    "\n\n" +
    readme.slice(end);

  await fs.writeFile("README.md", nextReadme, "utf8");
  console.log("Profile README updated from " + publicRepos.length + " public repositories.");
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});
