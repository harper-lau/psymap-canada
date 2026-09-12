import { SITE_CONFIG } from "./config.js?v=20260908-1";

const DATA_FILES = {
  universities: "data/universities.json",
  professors: "data/professors.json",
  labs: "data/labs.json",
  courses: "data/courses.json",
  topics: "data/topics.json",
  questions: "data/questions.json",
  fieldGuides: "data/field-guides.json",
  rankings: "data/rankings.json",
  quiz: "data/interest-quiz.json"
};

const dataCache = new Map();

export async function fetchJson(name) {
  if (!Object.hasOwn(DATA_FILES, name)) {
    throw new Error(`Unknown data collection: ${name}`);
  }

  if (!dataCache.has(name)) {
    dataCache.set(name, fetch(DATA_FILES[name], { cache: "no-store" }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Could not load ${name} (${response.status}).`);
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error(`Expected ${name} to contain a JSON array.`);
      }
      return payload;
    }));
  }

  return dataCache.get(name);
}

export async function loadData(names) {
  const entries = await Promise.all(names.map(async (name) => [name, await fetchJson(name)]));
  return Object.fromEntries(entries);
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function byId(items, id) {
  return items.find((item) => item.id === id);
}

export function unique(items) {
  return [...new Set(items)];
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "#";
  } catch {
    return "#";
  }
}

export function formatDate(value) {
  if (!value) return "Not yet recorded";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function formatLocation(location) {
  if (!location) return "Location unavailable";
  return [location.city, location.province, location.country].filter(Boolean).join(", ");
}

export function setDocumentTitle(title) {
  document.title = `${title} — ${SITE_CONFIG.brand.fullName}`;
}

export function includesId(item, field, id) {
  return Array.isArray(item?.[field]) && item[field].includes(id);
}

export function getByIds(items, ids = []) {
  const lookup = new Map(items.map((item) => [item.id, item]));
  return ids.map((id) => lookup.get(id)).filter(Boolean);
}
