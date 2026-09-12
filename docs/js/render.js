import { escapeHtml, formatLocation, safeExternalUrl } from "./utils.js?v=20260908-1";

function tagMarkup(values, className = "tag") {
  if (!values?.length) return '<span class="tag">Not listed</span>';
  return values.map((value) => `<span class="${className}">${escapeHtml(value)}</span>`).join("");
}

function isVerifiedProfessor(professor) {
  return professor?.dataStatus === "source-backed" && professor?.verification?.status === "verified" && professor?.isSample === false;
}

export function renderTopicCard(topic, match = null) {
  const reason = match?.terms?.length
    ? `<div class="tag-row"><span class="tag tag-lavender">Matched: ${escapeHtml(match.terms.slice(0, 2).join(", "))}</span></div>`
    : `<div class="tag-row">${tagMarkup(topic.aliases.slice(0, 2))}</div>`;

  return `
    <a class="topic-card" href="topic.html?id=${encodeURIComponent(topic.id)}">
      <div class="topic-card-top">
        <span class="topic-domain">${escapeHtml(topic.broadAreas[0])}</span>
        <span class="topic-arrow" aria-hidden="true">→</span>
      </div>
      <h3>${escapeHtml(topic.name)}</h3>
      <p>${escapeHtml(topic.description)}</p>
      ${reason}
    </a>`;
}

export function renderUniversityCard(university, counts = {}) {
  const sourceBacked = university.dataStatus === "source-backed";
  const hasVerifiedProfessors = (counts.professors ?? 0) > 0;
  const statusLabel = sourceBacked ? "Official program context + profiles" : hasVerifiedProfessors ? "Professor profiles checked" : "Research pending";
  return `
    <article class="university-card">
      <div class="university-card-top">
        <span class="university-code" aria-hidden="true">${escapeHtml(university.shortName)}</span>
        <span class="tag ${sourceBacked || hasVerifiedProfessors ? "tag-lavender" : ""}">${statusLabel}</span>
      </div>
      <h3>${escapeHtml(university.name)}</h3>
      <p class="location">${escapeHtml(formatLocation(university.location))}</p>
      <p>${escapeHtml(university.departmentSummary ?? "Psychology profile research is pending.")}</p>
      <div class="tag-row">
        <span class="tag">${counts.professors ?? 0} professor profiles</span>
        <span class="tag">${counts.labs ?? 0} sample labs</span>
        <span class="tag">${counts.courses ?? 0} sample courses</span>
      </div>
      <a class="button button-text" href="university.html?id=${encodeURIComponent(university.id)}">Explore university context <span aria-hidden="true">→</span></a>
    </article>`;
}

export function renderProfessorCard(professor, university) {
  const verified = isVerifiedProfessor(professor);
  const sample = professor.isSample === true || professor.dataStatus === "sample";
  const typeLabel = verified ? "Professor" : sample ? "Sample researcher" : "Professor profile";
  const statusLabel = verified ? "Official source checked" : sample ? "Fictional" : "Verification pending";
  const statusClass = sample ? "tag tag-sample" : "tag tag-lavender";
  return `
    <article class="entity-card">
      <div class="entity-card-top"><span class="card-type">${typeLabel}</span><span class="${statusClass}">${statusLabel}</span></div>
      <h3><a href="professor.html?id=${encodeURIComponent(professor.id)}">${escapeHtml(professor.name)}</a></h3>
      <p>${escapeHtml(professor.summary)}</p>
      <div class="tag-row">${tagMarkup((professor.psymapAreas ?? []).slice(0, 2), "tag tag-lavender")}</div>
      <a class="card-link" href="professor.html?id=${encodeURIComponent(professor.id)}">View profile at ${escapeHtml(university?.shortName ?? "university")} <span aria-hidden="true">→</span></a>
    </article>`;
}

export function renderLabCard(lab, university) {
  return `
    <article class="entity-card">
      <div class="entity-card-top"><span class="card-type">Sample lab</span><span class="tag tag-sample">Fictional</span></div>
      <h3>${escapeHtml(lab.name)}</h3>
      <p>${escapeHtml(lab.summary)}</p>
      <div class="tag-row">${tagMarkup((lab.methods ?? []).slice(0, 2))}</div>
      <span class="card-link">Representative ${escapeHtml(university?.shortName ?? "university")} pathway</span>
    </article>`;
}

export function renderCourseCard(course, university) {
  return `
    <article class="entity-card">
      <div class="entity-card-top"><span class="card-type">Sample course</span><span class="tag tag-sample">Representative</span></div>
      <h3>${escapeHtml(course.name)}</h3>
      <p>${escapeHtml(course.summary)}</p>
      <div class="tag-row"><span class="tag">${escapeHtml(course.code)}</span></div>
      <span class="card-link">Not an official ${escapeHtml(university?.shortName ?? "university")} course listing</span>
    </article>`;
}

export function renderSimpleTopicLinks(topics) {
  if (!topics.length) return '<p class="callout">No related topics are listed yet.</p>';
  return topics.map((topic) => `<a class="tag-link" href="topic.html?id=${encodeURIComponent(topic.id)}">${escapeHtml(topic.name)} <span aria-hidden="true">→</span></a>`).join("");
}

export function renderList(items, className = "clean-list") {
  if (!items?.length) return '<p class="callout">No items are listed yet.</p>';
  return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function renderSources(sources) {
  if (!sources?.length) return '<p class="callout">No official source is linked yet.</p>';
  return `<ul class="source-list">${sources.map((source) => `
    <li><a href="${escapeHtml(safeExternalUrl(source.url))}"><span>${escapeHtml(source.label)}</span><span aria-hidden="true">↗</span></a></li>`).join("")}</ul>`;
}

export function renderErrorState(title, message) {
  return `
    <section class="error-state" role="alert">
      <p class="eyebrow"><span></span>Path not found</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <div class="error-actions">
        <a class="button button-primary" href="explore.html">Browse all topics</a>
        <a class="button button-secondary" href="index.html">Return home</a>
      </div>
    </section>`;
}
