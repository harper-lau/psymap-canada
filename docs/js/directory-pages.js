import {
  escapeHtml,
  formatLocation,
  getQueryParam,
  loadData,
  safeExternalUrl
} from "./utils.js?v=20260908-1";
import { normalizeText } from "./search.js?v=20260908-1";

function optionMarkup(value, label, selected = false) {
  return `<option value="${escapeHtml(value)}"${selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function emptyState(title, detail) {
  return `<div class="directory-empty" role="status"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div>`;
}

function professorSortName(professor) {
  if (professor.sortName) return professor.sortName;
  const parts = String(professor.name ?? "").trim().split(/\s+/);
  return [parts.at(-1), ...parts.slice(0, -1)].filter(Boolean).join(", ");
}

function isVerifiedProfessor(professor) {
  return professor?.dataStatus === "source-backed" && professor?.verification?.status === "verified" && professor?.isSample === false;
}

function contactMarkup(professor) {
  const email = typeof professor.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(professor.email)
    ? `<a href="mailto:${escapeHtml(professor.email)}">${escapeHtml(professor.email)}</a>`
    : '<span class="unavailable">Email unavailable</span>';
  const profileUrl = safeExternalUrl(professor.profileUrl);
  const profile = profileUrl !== "#"
    ? `<a href="${escapeHtml(profileUrl)}">Official profile <span aria-hidden="true">↗</span></a>`
    : '<span class="unavailable">Personal page unavailable</span>';
  return `<div class="contact-row">${email}${profile}</div>`;
}

export async function initProfessorsPage() {
  const provinceSelect = document.querySelector("#professor-province");
  const schoolSelect = document.querySelector("#professor-school");
  const fieldSelect = document.querySelector("#professor-field");
  const results = document.querySelector("#professor-results");
  const count = document.querySelector("#professor-count");
  if (!provinceSelect || !schoolSelect || !fieldSelect || !results || !count) return;

  try {
    const { universities, professors, topics } = await loadData(["universities", "professors", "topics"]);
    const universityLookup = new Map(universities.map((item) => [item.id, item]));
    const topicLookup = new Map(topics.map((item) => [item.id, item]));
    const requestedField = getQueryParam("field")?.trim() ?? "";

    const provinces = [...new Set(universities.map((item) => item.location?.province).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    provinceSelect.innerHTML = optionMarkup("", "All provinces") + provinces.map((province) => optionMarkup(province, province)).join("");

    function placeFilteredProfessors() {
      const province = provinceSelect.value;
      const school = schoolSelect.value;
      return professors.filter((professor) => {
        const university = universityLookup.get(professor.universityId);
        return (!province || university?.location?.province === province) && (!school || professor.universityId === school);
      });
    }

    function updateSchoolOptions() {
      const selected = schoolSelect.value;
      const schools = universities
        .filter((item) => !provinceSelect.value || item.location?.province === provinceSelect.value)
        .sort((a, b) => a.name.localeCompare(b.name));
      schoolSelect.innerHTML = optionMarkup("", "All schools") + schools.map((school) => optionMarkup(school.id, school.name, school.id === selected)).join("");
      if (![...schoolSelect.options].some((option) => option.value === selected)) schoolSelect.value = "";
    }

    function updateFieldOptions(preferred = fieldSelect.value) {
      const availableTopicIds = new Set(placeFilteredProfessors().flatMap((professor) => professor.topicIds ?? []));
      const fields = topics
        .filter((topic) => availableTopicIds.has(topic.id))
        .sort((a, b) => a.name.localeCompare(b.name));
      fieldSelect.innerHTML = optionMarkup("", "All fields") + fields.map((field) => optionMarkup(field.id, field.name, field.id === preferred)).join("");
      if ([...fieldSelect.options].some((option) => option.value === preferred)) fieldSelect.value = preferred;
    }

    function render() {
      const field = fieldSelect.value;
      const filtered = placeFilteredProfessors()
        .filter((professor) => !field || (professor.topicIds ?? []).includes(field))
        .sort((a, b) => professorSortName(a).localeCompare(professorSortName(b), "en-CA", { sensitivity: "base" }));

      count.textContent = `${filtered.length} ${filtered.length === 1 ? "profile" : "profiles"} shown · alphabetical, never ranked`;
      if (!filtered.length) {
        results.innerHTML = emptyState("No profiles match these filters.", "Try All schools or All fields. School scaffolds without researched professor data stay empty rather than inventing people.");
        return;
      }

      results.innerHTML = filtered.map((professor) => {
        const university = universityLookup.get(professor.universityId);
        const relatedTopics = (professor.topicIds ?? []).map((id) => topicLookup.get(id)).filter(Boolean);
        const verified = isVerifiedProfessor(professor);
        const sample = professor.isSample === true || professor.dataStatus === "sample";
        const typeLabel = verified ? "Professor" : sample ? "Fictional sample" : "Professor profile";
        const statusLabel = verified ? "Official source checked" : sample ? "Not a real person" : "Verification pending";
        const statusClass = sample ? "tag tag-sample" : "tag tag-lavender";
        return `
          <article class="professor-directory-card">
            <div class="entity-card-top"><span class="card-type">${typeLabel}</span><span class="${statusClass}">${statusLabel}</span></div>
            <h2><a href="professor.html?id=${encodeURIComponent(professor.id)}">${escapeHtml(professor.name)}</a></h2>
            <p class="professor-school"><a href="university.html?id=${encodeURIComponent(university?.id ?? "")}">${escapeHtml(university?.name ?? "School unavailable")}</a></p>
            <p>${escapeHtml(professor.summary ?? "Research summary unavailable.")}</p>
            <div class="tag-row">${relatedTopics.slice(0, 4).map((topic) => `<a class="tag-link" href="topic.html?id=${encodeURIComponent(topic.id)}">${escapeHtml(topic.name)}</a>`).join("")}</div>
            ${contactMarkup(professor)}
            <a class="card-link" href="professor.html?id=${encodeURIComponent(professor.id)}">View profile and sources <span aria-hidden="true">→</span></a>
          </article>`;
      }).join("");
    }

    provinceSelect.addEventListener("change", () => {
      schoolSelect.value = "";
      fieldSelect.value = "";
      updateSchoolOptions();
      updateFieldOptions();
      render();
    });
    schoolSelect.addEventListener("change", () => {
      fieldSelect.value = "";
      updateFieldOptions();
      render();
    });
    fieldSelect.addEventListener("change", render);

    updateSchoolOptions();
    updateFieldOptions(requestedField);
    render();
  } catch (error) {
    console.error(error);
    results.innerHTML = emptyState("The directory could not load.", "Refresh the page to try loading the local data again.");
  }
}

const COMPARISON_FIELDS = [
  { id: "overall-psychology", label: "Overall psychology" },
  { id: "clinical-psychology", label: "Clinical" },
  { id: "memory-learning", label: "Cognitive" },
  { id: "human-development", label: "Developmental" },
  { id: "social-influence", label: "Social" },
  { id: "brain-behaviour", label: "Neuroscience" },
  { id: "forensic-psychology", label: "Forensic" }
];

function createRankingLookup(series) {
  const lookup = new Map();
  series.forEach((item) => {
    (item.entries ?? []).forEach((entry) => {
      lookup.set(`${entry.universityId}:${item.fieldId}`, { entry, series: item });
    });
  });
  return lookup;
}

function rankingCell(universityId, fieldId, lookup) {
  const record = lookup.get(`${universityId}:${fieldId}`);
  if (!record) {
    return '<span class="rank-na">N/A</span><small>No comparable sourced ranking added</small>';
  }
  const sourceUrl = safeExternalUrl(record.series.source?.url);
  const label = record.entry.rankLabel ?? (record.entry.rank ? `#${record.entry.rank}` : "Listed");
  return `<strong class="rank-value">${escapeHtml(label)}</strong><small>${escapeHtml(record.series.source?.publisher ?? "Source")} · ${escapeHtml(record.series.year ?? "Year unavailable")}</small>${sourceUrl !== "#" ? `<a class="table-source-link" href="${escapeHtml(sourceUrl)}">Source <span aria-hidden="true">↗</span></a>` : ""}`;
}

export async function initSchoolsPage() {
  const provinceSelect = document.querySelector("#school-province");
  const tableHead = document.querySelector("#school-table-head");
  const tableBody = document.querySelector("#school-table-body");
  const count = document.querySelector("#school-count");
  const sourceList = document.querySelector("#ranking-source-list");
  if (!provinceSelect || !tableHead || !tableBody || !count || !sourceList) return;

  try {
    const { universities, professors, rankings } = await loadData(["universities", "professors", "rankings"]);
    const rankingLookup = createRankingLookup(rankings);
    const professorCounts = new Map(universities.map((school) => [
      school.id,
      professors.filter((professor) => professor.universityId === school.id && isVerifiedProfessor(professor)).length
    ]));
    const provinces = [...new Set(universities.map((item) => item.location?.province).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    provinceSelect.innerHTML = optionMarkup("", "All provinces") + provinces.map((province) => optionMarkup(province, province)).join("");
    tableHead.innerHTML = `<tr><th scope="col">School</th><th scope="col">Profile</th>${COMPARISON_FIELDS.map((field) => `<th scope="col">${escapeHtml(field.label)}</th>`).join("")}</tr>`;

    function render() {
      const schools = universities
        .filter((item) => !provinceSelect.value || item.location?.province === provinceSelect.value)
        .sort((a, b) => {
          const priority = (school) => school.dataStatus === "source-backed" ? 2 : (professorCounts.get(school.id) ?? 0) > 0 ? 1 : 0;
          const sourcePriority = priority(b) - priority(a);
          return sourcePriority || a.name.localeCompare(b.name);
        });
      count.textContent = `${schools.length} of ${universities.length} school entries shown · directory coverage is not a top-${universities.length} claim`;
      tableBody.innerHTML = schools.map((school) => {
        const hasVerifiedProfessors = (professorCounts.get(school.id) ?? 0) > 0;
        const profileStarted = school.dataStatus === "source-backed" || hasVerifiedProfessors;
        const profileLabel = school.dataStatus === "source-backed" ? "Program context + profiles" : hasVerifiedProfessors ? "Professor profiles checked" : "Research pending";
        return `
        <tr>
          <th scope="row"><a href="university.html?id=${encodeURIComponent(school.id)}">${escapeHtml(school.name)}</a><small>${escapeHtml(formatLocation(school.location))}</small></th>
          <td><span class="profile-status ${profileStarted ? "is-started" : ""}">${profileLabel}</span></td>
          ${COMPARISON_FIELDS.map((field) => `<td>${rankingCell(school.id, field.id, rankingLookup)}</td>`).join("")}
        </tr>`;
      }).join("");
    }

    if (!rankings.length) {
      sourceList.innerHTML = '<div class="directory-empty"><h3>No ranking series are published in this preview.</h3><p>The comparison structure is ready, but every rank remains N/A until a comparable third-party series has a source, year, URL, scope, and methodology note.</p></div>';
    } else {
      sourceList.innerHTML = rankings.map((series) => `
        <article class="source-series"><p class="card-type">${escapeHtml(series.fieldLabel ?? "Psychology ranking")}</p><h3>${escapeHtml(series.title)}</h3><p>${escapeHtml(series.methodologyNote ?? "Methodology note unavailable.")}</p><a href="${escapeHtml(safeExternalUrl(series.source?.url))}">${escapeHtml(series.source?.publisher ?? "Open source")} · ${escapeHtml(series.year ?? "Year unavailable")} <span aria-hidden="true">↗</span></a></article>`).join("");
    }

    provinceSelect.addEventListener("change", render);
    render();
  } catch (error) {
    console.error(error);
    tableBody.innerHTML = '<tr><td colspan="9">The comparison data could not load. Please refresh and try again.</td></tr>';
  }
}

export async function initFieldsPage() {
  const filter = document.querySelector("#field-filter");
  const grid = document.querySelector("#field-directory");
  const count = document.querySelector("#field-count");
  if (!filter || !grid || !count) return;

  try {
    const { topics, fieldGuides, professors, courses } = await loadData(["topics", "fieldGuides", "professors", "courses"]);
    const guideLookup = new Map(fieldGuides.map((guide) => [guide.topicId, guide]));

    function render() {
      const query = normalizeText(filter.value);
      const fields = topics.filter((topic) => {
        const haystack = normalizeText([topic.name, topic.description, ...(topic.aliases ?? []), ...(topic.broadAreas ?? [])].join(" "));
        return !query || haystack.includes(query);
      });
      count.textContent = `${fields.length} of ${topics.length} connected field guides shown`;
      if (!fields.length) {
        grid.innerHTML = emptyState("No field matches that phrase.", "Try memory, social, health, development, language, or brain.");
        return;
      }
      grid.innerHTML = fields.map((topic, index) => {
        const guide = guideLookup.get(topic.id);
        const professorCount = professors.filter((item) => (item.topicIds ?? []).includes(topic.id)).length;
        const courseCount = courses.filter((item) => (item.topicIds ?? []).includes(topic.id)).length;
        return `
          <a class="field-directory-card" href="topic.html?id=${encodeURIComponent(topic.id)}">
            <div class="field-card-top"><span>${String(index + 1).padStart(2, "0")}</span><small>${escapeHtml((topic.broadAreas ?? ["Psychology"])[0])}</small></div>
            <h2>${escapeHtml(topic.name)}</h2>
            <p>${escapeHtml(topic.description)}</p>
            <div class="field-signals">${(guide?.interestSignals ?? []).slice(0, 2).map((signal) => `<span>${escapeHtml(signal)}</span>`).join("")}</div>
            <small class="field-path-count">${professorCount} professor profile${professorCount === 1 ? "" : "s"} · ${courseCount} representative course${courseCount === 1 ? "" : "s"}</small>
            <strong>Open field guide <span aria-hidden="true">→</span></strong>
          </a>`;
      }).join("");
    }

    filter.addEventListener("input", render);
    render();
  } catch (error) {
    console.error(error);
    grid.innerHTML = emptyState("The field guide could not load.", "Refresh the page to try loading the local data again.");
  }
}
