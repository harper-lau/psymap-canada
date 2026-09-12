import {
  byId,
  escapeHtml,
  formatDate,
  formatLocation,
  getByIds,
  getQueryParam,
  includesId,
  loadData,
  safeExternalUrl,
  setDocumentTitle,
  unique
} from "./utils.js?v=20260908-1";
import { matchQuestion } from "./search.js?v=20260908-1";
import { createSearchRecords, searchCatalog } from "./search.js?v=20260908-1";
import { PAGE_NAV_GROUPS, SITE_CONFIG } from "./config.js?v=20260908-1";
import { initFieldsPage, initProfessorsPage, initSchoolsPage } from "./directory-pages.js?v=20260912-1";
import { initQuizPage } from "./quiz.js?v=20260908-1";
import {
  renderCourseCard,
  renderErrorState,
  renderLabCard,
  renderList,
  renderProfessorCard,
  renderSimpleTopicLinks,
  renderSources,
  renderTopicCard,
  renderUniversityCard
} from "./render.js?v=20260908-1";

function initSiteChrome(page) {
  document.title = document.title.replaceAll("PsyMap Canada", SITE_CONFIG.brand.fullName);
  const header = document.querySelector(".site-header .header-inner");
  const activeGroup = PAGE_NAV_GROUPS[page] ?? null;
  if (header) {
    header.innerHTML = `
      <a class="brand brand-symbol" href="index.html" aria-label="${SITE_CONFIG.brand.fullName} home">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="brand-short">${SITE_CONFIG.brand.shortName}</span>
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation">
        <span>Menu</span><i aria-hidden="true"></i>
      </button>
      <nav class="primary-nav" id="primary-navigation" aria-label="Primary navigation">
        ${SITE_CONFIG.navigation.map((item) => `<a href="${item.href}"${activeGroup === item.id ? ' aria-current="page"' : ""}>${item.label}</a>`).join("")}
      </nav>
      <div class="brand-wordmark" aria-label="${SITE_CONFIG.brand.fullName}">
        <span>${SITE_CONFIG.brand.wordmarkPrimary}</span><small>${SITE_CONFIG.brand.wordmarkSuffix}</small>
      </div>`;

    const toggle = header.querySelector(".nav-toggle");
    const navigation = header.querySelector(".primary-nav");
    const closeMenu = () => {
      toggle?.setAttribute("aria-expanded", "false");
      navigation?.classList.remove("is-open");
    };
    toggle?.addEventListener("click", () => {
      const opening = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(opening));
      navigation?.classList.toggle("is-open", opening);
    });
    navigation?.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }

  const footer = document.querySelector(".site-footer .footer-inner");
  if (footer) {
    footer.innerHTML = `
      <div><a class="brand brand-footer" href="index.html">${SITE_CONFIG.brand.shortName}</a><p>${SITE_CONFIG.brand.descriptor}.</p></div>
      <div class="footer-links"><a href="professors.html">Professors</a><a href="schools.html">Schools</a><a href="fields.html">Fields</a><a href="about.html">Method &amp; limitations</a></div>
      <p class="footer-note">Static preview · Official sources checked · Samples labelled</p>`;
  }
}

function bindQuestionForm() {
  const form = document.querySelector("#question-form");
  const input = document.querySelector("#question-input");
  if (!form || !input) return;

  form.addEventListener("submit", (event) => {
    input.value = input.value.trim();
    if (!input.value) {
      event.preventDefault();
      input.setCustomValidity("Please enter a question or choose an example.");
      input.reportValidity();
      return;
    }
    input.setCustomValidity("");
  });

  input.addEventListener("input", () => input.setCustomValidity(""));
}

async function initHome() {
  const form = document.querySelector("#site-search-form");
  const input = document.querySelector("#site-search-input");
  const list = document.querySelector("#search-suggestions");
  const status = document.querySelector("#search-status");
  if (!form || !input || !list || !status) return;

  try {
    const data = await loadData(["universities", "professors", "topics"]);
    const records = createSearchRecords(data);
    let visibleResults = [];
    let activeIndex = -1;

    const closeSuggestions = () => {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
    };

    const setActiveResult = (nextIndex) => {
      if (!visibleResults.length) return;
      activeIndex = (nextIndex + visibleResults.length) % visibleResults.length;
      list.querySelectorAll("[role='option']").forEach((option, index) => {
        const active = index === activeIndex;
        option.classList.toggle("is-active", active);
        option.setAttribute("aria-selected", String(active));
        if (active) input.setAttribute("aria-activedescendant", option.id);
      });
    };

    const renderSuggestions = () => {
      const query = input.value.trim();
      if (query.length < 2) {
        status.textContent = query ? "Keep typing to search the map." : "";
        closeSuggestions();
        return;
      }

      const { results, suggestion } = searchCatalog(query, records);
      visibleResults = results;
      activeIndex = -1;
      if (!results.length) {
        list.innerHTML = '<li class="search-empty" role="option" aria-disabled="true">No close match yet. Try a school name, professor, or field.</li>';
        status.textContent = "No close match found.";
      } else {
        const suggestionMarkup = suggestion
          ? `<li class="search-correction" role="presentation">Did you mean <strong>${escapeHtml(suggestion)}</strong>?</li>`
          : "";
        list.innerHTML = `${suggestionMarkup}${results.map((result, index) => `
          <li role="presentation">
            <a id="search-option-${index}" role="option" aria-selected="false" href="${result.href}" tabindex="-1">
              <span class="search-result-type">${escapeHtml(result.type)}</span>
              <strong>${escapeHtml(result.label)}</strong>
              <small>${escapeHtml(result.description)}</small>
            </a>
          </li>`).join("")}`;
        status.textContent = `${results.length} result${results.length === 1 ? "" : "s"} available.${suggestion ? ` Did you mean ${suggestion}?` : ""}`;
      }
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    };

    input.addEventListener("input", renderSuggestions);
    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 2) renderSuggestions();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveResult(activeIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveResult(activeIndex - 1);
      } else if (event.key === "Escape") {
        closeSuggestions();
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        window.location.assign(visibleResults[activeIndex].href);
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const { results } = searchCatalog(input.value, records);
      if (results[0]) {
        window.location.assign(results[0].href);
      } else {
        input.setCustomValidity("Try a school, professor, or field from the map.");
        input.reportValidity();
      }
    });
    input.addEventListener("input", () => input.setCustomValidity(""));
    document.addEventListener("click", (event) => {
      if (!form.contains(event.target)) closeSuggestions();
    });
  } catch (error) {
    console.error(error);
    status.textContent = "Search data could not load. Please use the navigation above.";
  }
}

async function initExplore() {
  bindQuestionForm();
  const topicBrowser = document.querySelector("#topic-browser");
  const universityBrowser = document.querySelector("#university-browser");

  try {
    const { topics, questions, universities, professors, labs, courses } = await loadData([
      "topics", "questions", "universities", "professors", "labs", "courses"
    ]);

    topicBrowser.innerHTML = topics.map((topic) => renderTopicCard(topic)).join("");
    universityBrowser.innerHTML = universities.map((university) => renderUniversityCard(university, {
      professors: professors.filter((item) => item.universityId === university.id).length,
      labs: labs.filter((item) => item.universityId === university.id).length,
      courses: courses.filter((item) => item.universityId === university.id).length
    })).join("");

    const rawQuestion = getQueryParam("q") ?? "";
    const question = rawQuestion.trim().slice(0, 240);
    if (!question) return;

    const input = document.querySelector("#question-input");
    if (input) input.value = question;

    setDocumentTitle(`Paths for “${question.slice(0, 54)}${question.length > 54 ? "…" : ""}”`);
    document.querySelector("#explore-title").textContent = "Your question can open more than one door.";
    document.querySelector("#explore-intro").textContent = `${SITE_CONFIG.brand.fullName} looks for topic connections, not a single answer.`;

    const resultsSection = document.querySelector("#question-results");
    const context = document.querySelector("#question-context");
    const message = document.querySelector("#match-message");
    const results = document.querySelector("#matched-topics");
    resultsSection.hidden = false;
    context.innerHTML = `<div class="question-context-card"><p class="eyebrow"><span></span>Your question</p><blockquote>“${escapeHtml(question)}”</blockquote></div>`;

    const match = matchQuestion(question, questions, topics, 4);
    if (!match.matches.length) {
      message.innerHTML = "<strong>We couldn't confidently map this question yet.</strong> Try different wording, or explore the Psychology topics below.";
      results.innerHTML = "";
      return;
    }

    const terms = match.matchedTerms.length
      ? ` Matched words or phrases include <strong>${escapeHtml(match.matchedTerms.join(", "))}</strong>.`
      : "";
    message.innerHTML = `<strong>One question may connect to several areas.</strong> These suggestions come from transparent keyword overlap in the local catalogue—not live AI or an expert assessment.${terms}`;
    results.innerHTML = match.matches.map((entry) => renderTopicCard(entry.topic, entry)).join("");
  } catch (error) {
    console.error(error);
    const message = `${SITE_CONFIG.brand.fullName} could not load its local topic data. Please refresh the page or try again later.`;
    topicBrowser.innerHTML = `<div class="error-state" role="alert"><h2>Topics could not load</h2><p>${message}</p></div>`;
    universityBrowser.innerHTML = `<div class="error-state" role="alert"><h2>Universities could not load</h2><p>${message}</p></div>`;
  }
}

function topicUniversityIds(topicId, professors, labs, courses) {
  return unique([
    ...professors.filter((item) => includesId(item, "topicIds", topicId)).map((item) => item.universityId),
    ...labs.filter((item) => includesId(item, "topicIds", topicId)).map((item) => item.universityId),
    ...courses.filter((item) => includesId(item, "topicIds", topicId)).map((item) => item.universityId)
  ]);
}

async function initTopic() {
  const root = document.querySelector("#topic-view");
  const id = getQueryParam("id")?.trim();
  if (!id) {
    root.innerHTML = renderErrorState("No topic selected", "Choose a topic from Explore to follow its research pathways.");
    return;
  }

  try {
    const { topics, professors, labs, courses, universities, fieldGuides } = await loadData([
      "topics", "professors", "labs", "courses", "universities", "fieldGuides"
    ]);
    const topic = byId(topics, id);
    if (!topic) {
      root.innerHTML = renderErrorState("We couldn't find that topic", "The topic may be missing or the link may be outdated.");
      return;
    }

    setDocumentTitle(topic.name);
    const relatedTopics = getByIds(topics, topic.relatedTopicIds);
    const matchingProfessors = professors.filter((item) => includesId(item, "topicIds", topic.id));
    const matchingLabs = labs.filter((item) => includesId(item, "topicIds", topic.id));
    const matchingCourses = courses.filter((item) => includesId(item, "topicIds", topic.id));
    const matchingUniversities = getByIds(
      universities,
      topicUniversityIds(topic.id, professors, labs, courses)
    );
    const universityLookup = new Map(universities.map((item) => [item.id, item]));
    const guide = fieldGuides.find((item) => item.topicId === topic.id);

    root.innerHTML = `
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="fields.html">Fields</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(topic.name)}</span></nav>
      <header class="detail-hero">
        <div>
          <p class="eyebrow"><span></span>Psychology topic</p>
          <h1>${escapeHtml(topic.name)}</h1>
          <p class="lede">${escapeHtml(topic.description)}</p>
          <div class="tag-row">${topic.broadAreas.map((area) => `<span class="tag tag-lavender">${escapeHtml(area)}</span>`).join("")}</div>
        </div>
        <aside class="meta-panel">
          <dl class="meta-list">
            <div><dt>Classification</dt><dd>PsyMap normalized topic</dd></div>
            <div><dt>Connected records</dt><dd>${matchingProfessors.length} professors · ${matchingLabs.length} sample labs · ${matchingCourses.length} representative courses</dd></div>
            <div><dt>University context</dt><dd>${escapeHtml(matchingUniversities.map((item) => item.shortName).join(" + "))}</dd></div>
          </dl>
        </aside>
      </header>

      <div class="sample-notice field-guide-notice"><strong>Student orientation, not a career prescription</strong><p>Study and career ideas below are illustrative starting points. Always verify current programs, prerequisites, and regulated-profession requirements with the relevant institution or professional body.</p></div>

      <section class="detail-section" aria-labelledby="fit-title">
        <div class="detail-section-title"><span>01</span><h2 id="fit-title">What might draw you to this field?</h2></div>
        <div class="detail-columns"><div><h3 class="subsection-title">Interest signals</h3>${renderList(guide?.interestSignals ?? [])}</div><div><h3 class="subsection-title">Possible study path</h3>${renderList(guide?.studyPathways ?? [])}</div></div>
      </section>

      <section class="detail-section" aria-labelledby="career-title">
        <div class="detail-section-title"><span>02</span><h2 id="career-title">Where this interest could lead</h2></div>
        <p class="section-intro">These are broad examples, not guarantees. Many roles require additional education, supervised experience, or professional registration.</p>
        ${renderList(guide?.careers ?? [])}
      </section>

      <section class="detail-section" aria-labelledby="questions-title">
        <div class="detail-section-title"><span>03</span><h2 id="questions-title">Questions researchers might explore</h2></div>
        ${renderList(topic.exampleQuestions, "question-list")}
      </section>

      <section class="detail-section" aria-labelledby="related-title">
        <div class="detail-section-title"><span>04</span><h2 id="related-title">Related fields</h2></div>
        <div class="link-row">${renderSimpleTopicLinks(relatedTopics)}</div>
      </section>

      <section class="detail-section" aria-labelledby="people-title">
        <div class="detail-section-title"><span>05</span><h2 id="people-title">Connected professor profiles</h2></div>
        <div class="sample-notice"><strong>Know which records are verified</strong><p>Professor cards state their official-source status. Lab and course cards remain fictional or representative learning records and are not official university listings.</p></div>
        <h3 class="subsection-title">Professors</h3>
        <div class="entity-grid">${matchingProfessors.length ? matchingProfessors.map((item) => renderProfessorCard(item, universityLookup.get(item.universityId))).join("") : '<p class="callout">No professor profile is connected to this field yet.</p>'}</div>
      </section>

      <section class="detail-section" aria-labelledby="labs-title">
        <div class="detail-section-title"><span>06</span><h2 id="labs-title">Labs &amp; English-language course examples</h2></div>
        <div class="detail-columns">
          <div><h3 class="subsection-title">Sample labs</h3><div class="entity-grid">${matchingLabs.length ? matchingLabs.map((item) => renderLabCard(item, universityLookup.get(item.universityId))).join("") : '<p class="callout">No sample lab is connected yet.</p>'}</div></div>
          <div><h3 class="subsection-title">Representative courses</h3><div class="entity-grid">${matchingCourses.length ? matchingCourses.map((item) => renderCourseCard(item, universityLookup.get(item.universityId))).join("") : '<p class="callout">No verified or representative course is connected yet.</p>'}</div></div>
        </div>
      </section>

      <section class="detail-section" aria-labelledby="universities-title">
        <div class="detail-section-title"><span>07</span><h2 id="universities-title">School context</h2></div>
        <div class="university-grid">${matchingUniversities.length ? matchingUniversities.map((university) => renderUniversityCard(university, {
          professors: professors.filter((item) => item.universityId === university.id && includesId(item, "topicIds", topic.id)).length,
          labs: labs.filter((item) => item.universityId === university.id && includesId(item, "topicIds", topic.id)).length,
          courses: courses.filter((item) => item.universityId === university.id && includesId(item, "topicIds", topic.id)).length
        })).join("") : '<p class="callout">No school pathway is connected to this field yet.</p>'}</div>
      </section>`;
  } catch (error) {
    console.error(error);
    root.innerHTML = renderErrorState("This topic could not load", `${SITE_CONFIG.brand.fullName} could not read its local data. Please refresh and try again.`);
  }
}

async function initProfessor() {
  const root = document.querySelector("#professor-view");
  const id = getQueryParam("id")?.trim();
  if (!id) {
    root.innerHTML = renderErrorState("No professor selected", "Choose a professor from the directory or a field page to continue.");
    return;
  }

  try {
    const { professors, universities, topics, labs, courses } = await loadData([
      "professors", "universities", "topics", "labs", "courses"
    ]);
    const professor = byId(professors, id);
    if (!professor) {
      root.innerHTML = renderErrorState("We couldn't find that professor", "The profile may be missing or the link may be outdated.");
      return;
    }

    const university = byId(universities, professor.universityId);
    if (!university) {
      root.innerHTML = renderErrorState("This professor has no school record", "The profile is incomplete and cannot be shown responsibly yet.");
      return;
    }
    const relatedTopics = getByIds(topics, professor.topicIds ?? []);
    const relatedLabs = getByIds(labs, professor.labIds ?? []);
    const relatedCourses = getByIds(courses, professor.courseIds ?? []);
    const verification = professor.verification ?? { status: "pending", date: null, scope: "Verification details are unavailable." };
    const isSample = professor.isSample === true || professor.dataStatus === "sample";
    const isVerified = professor.dataStatus === "source-backed" && verification.status === "verified" && professor.isSample === false;
    const verificationBoxClass = isVerified ? "verification-box" : "verification-box verification-pending";
    const verificationBadgeClass = isVerified ? "verification-badge" : "verification-badge verification-badge-pending";
    const verificationLabel = isVerified ? verification.label : verification.label ?? "Human verification pending";
    const publicEmail = typeof professor.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(professor.email) ? professor.email : null;
    const publicProfileUrl = safeExternalUrl(professor.profileUrl);
    const sampleNoticeMarkup = isSample ? `<div class="sample-notice"><strong>Fictional sample identity</strong><p>${escapeHtml(professor.sampleNotice ?? "This record is a fictional development sample.")}</p></div>` : "";
    const editorialNoticeMarkup = professor.editorialNotice ? `<p class="callout">${escapeHtml(professor.editorialNotice)}</p>` : "";
    const methodsMarkup = professor.methods?.length ? renderList(professor.methods) : '<p class="callout"><span class="unavailable">Not summarized from the checked source.</span></p>';
    const populationsMarkup = professor.populations?.length ? renderList(professor.populations) : '<p class="callout"><span class="unavailable">Not summarized from the checked source.</span></p>';
    const labsMarkup = relatedLabs.length ? relatedLabs.map((item) => renderLabCard(item, university)).join("") : '<p class="callout">No verified lab is connected to this professor yet.</p>';
    const coursesMarkup = relatedCourses.length ? relatedCourses.map((item) => renderCourseCard(item, university)).join("") : '<p class="callout">No verified course is connected to this professor yet.</p>';
    setDocumentTitle(professor.name);

    root.innerHTML = `
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="professors.html">Professors</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(professor.name)}</span></nav>
      ${sampleNoticeMarkup}
      <header class="detail-hero">
        <div>
          <p class="eyebrow"><span></span>Professor profile</p>
          <h1>${escapeHtml(professor.name)}</h1>
          <p class="lede">${escapeHtml(professor.title)} · <a href="university.html?id=${encodeURIComponent(university.id)}">${escapeHtml(university.name)}</a></p>
          <div class="tag-row">${(professor.psymapAreas ?? []).map((area) => `<span class="tag tag-lavender">${escapeHtml(area)}</span>`).join("")}</div>
        </div>
        <aside class="${verificationBoxClass}">
          <span class="${verificationBadgeClass}">${escapeHtml(verificationLabel)}</span>
          <p><strong>Last verification date:</strong> ${escapeHtml(formatDate(verification.date))}</p>
          <p>${escapeHtml(verification.scope)}</p>
        </aside>
      </header>

      <section class="detail-section" aria-labelledby="research-title">
        <div class="detail-section-title"><span>01</span><h2 id="research-title">The research, in student-friendly language</h2></div>
        <div class="detail-columns">
          <div class="detail-copy"><h3>Research summary</h3><p>${escapeHtml(professor.summary)}</p></div>
          <div class="detail-copy"><h3>Classification</h3><dl class="meta-list"><div><dt>Official research area</dt><dd>${escapeHtml(professor.officialResearchArea ?? "Unavailable")}</dd></div><div><dt>Psychology Map fields</dt><dd>${escapeHtml((professor.psymapAreas ?? []).join(" · ") || "Unavailable")}</dd></div></dl></div>
        </div>
      </section>

      <section class="detail-section" aria-labelledby="topics-title">
        <div class="detail-section-title"><span>02</span><h2 id="topics-title">Topics</h2></div>
        <div class="link-row">${renderSimpleTopicLinks(relatedTopics)}</div>
      </section>

      <section class="detail-section" aria-labelledby="approach-title">
        <div class="detail-section-title"><span>03</span><h2 id="approach-title">How this research is studied</h2></div>
        <div class="detail-columns"><div><h3 class="subsection-title">Research methods</h3>${methodsMarkup}</div><div><h3 class="subsection-title">Population studied</h3>${populationsMarkup}</div></div>
      </section>

      <section class="detail-section" aria-labelledby="questions-title">
        <div class="detail-section-title"><span>04</span><h2 id="questions-title">Questions this work can inspire</h2></div>
        ${renderList(professor.questionsBehindResearch, "question-list")}
        ${editorialNoticeMarkup}
      </section>

      <section class="detail-section" aria-labelledby="pathways-title">
        <div class="detail-section-title"><span>05</span><h2 id="pathways-title">Related labs &amp; courses</h2></div>
        <div class="detail-columns"><div><h3 class="subsection-title">Labs</h3><div class="entity-grid">${labsMarkup}</div></div><div><h3 class="subsection-title">Courses</h3><div class="entity-grid">${coursesMarkup}</div></div></div>
      </section>

      <section class="detail-section" aria-labelledby="source-title">
        <div class="detail-section-title"><span>06</span><h2 id="source-title">University &amp; official context</h2></div>
        <div class="detail-columns">
          <article class="university-card"><span class="university-code" aria-hidden="true">${escapeHtml(university.shortName)}</span><h3>${escapeHtml(university.name)}</h3><p class="location">${escapeHtml(formatLocation(university.location))}</p><p>Continue to the university view for official program context, selected source-backed professor profiles, and clearly separated sample learning records.</p><a class="button button-secondary" href="university.html?id=${encodeURIComponent(university.id)}">View university <span aria-hidden="true">→</span></a></article>
          <aside class="source-box"><h3>Public contact &amp; official source</h3><dl class="contact-detail"><div><dt>Email</dt><dd>${publicEmail ? `<a href="mailto:${escapeHtml(publicEmail)}">${escapeHtml(publicEmail)}</a>` : '<span class="unavailable">Unavailable</span>'}</dd></div><div><dt>Personal page</dt><dd>${publicProfileUrl !== "#" ? `<a href="${escapeHtml(publicProfileUrl)}">Open official profile <span aria-hidden="true">↗</span></a>` : '<span class="unavailable">Unavailable</span>'}</dd></div></dl><p>${escapeHtml(professor.officialSource?.scope ?? "No official professor source has been linked.")}</p>${renderSources(professor.officialSource ? [professor.officialSource] : [])}</aside>
        </div>
      </section>`;
  } catch (error) {
    console.error(error);
    root.innerHTML = renderErrorState("This professor profile could not load", `${SITE_CONFIG.brand.fullName} could not read its local data. Please refresh and try again.`);
  }
}

async function initUniversity() {
  const root = document.querySelector("#university-view");
  const id = getQueryParam("id")?.trim();
  if (!id) {
    root.innerHTML = renderErrorState("No university selected", "Choose a school from the Schools or Explore page to continue.");
    return;
  }

  try {
    const { universities, professors, labs, courses, topics } = await loadData([
      "universities", "professors", "labs", "courses", "topics"
    ]);
    const university = byId(universities, id);
    if (!university) {
      root.innerHTML = renderErrorState("We couldn't find that university", "The university record may be missing or the link may be outdated.");
      return;
    }

    const matchingProfessors = professors.filter((item) => item.universityId === id);
    const matchingLabs = labs.filter((item) => item.universityId === id);
    const matchingCourses = courses.filter((item) => item.universityId === id);
    const topicIds = unique([
      ...matchingProfessors.flatMap((item) => item.topicIds ?? []),
      ...matchingLabs.flatMap((item) => item.topicIds ?? []),
      ...matchingCourses.flatMap((item) => item.topicIds ?? [])
    ]);
    const matchingTopics = getByIds(topics, topicIds);
    const facultyCount = university.facultyCount?.value ?? "Not yet verified";
    const sourceBacked = university.dataStatus === "source-backed";
    const profileStatus = sourceBacked ? "Official program context + selected profiles" : matchingProfessors.length ? "Selected professor profiles checked; program research pending" : "Research pending";
    setDocumentTitle(university.name);

    root.innerHTML = `
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="schools.html">Schools</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(university.shortName)}</span></nav>
      <header class="detail-hero">
        <div>
          <p class="eyebrow"><span></span>University context</p>
          <h1>${escapeHtml(university.name)}</h1>
          <p class="lede">${escapeHtml(university.departmentSummary ?? "Psychology profile research is pending.")}</p>
          <p class="location">${escapeHtml(formatLocation(university.location))}</p>
        </div>
        <aside class="meta-panel"><dl class="meta-list"><div><dt>Profile status</dt><dd>${escapeHtml(profileStatus)}</dd></div><div><dt>Sources last accessed</dt><dd>${escapeHtml(formatDate(university.sourceAccessedOn))}</dd></div><div><dt>Faculty count</dt><dd>${escapeHtml(facultyCount)}</dd></div><div><dt>Psychology Map records</dt><dd>${matchingProfessors.length} professor profiles · ${matchingLabs.length} sample labs · ${matchingCourses.length} representative courses</dd></div></dl></aside>
      </header>

      <section class="detail-section" aria-labelledby="program-title">
        <div class="detail-section-title"><span>01</span><h2 id="program-title">Official program context</h2></div>
        <div class="detail-columns"><div><h3 class="subsection-title">Degree options</h3>${renderList(university.degreeOptions ?? [])}</div><div><h3 class="subsection-title">${escapeHtml(university.officialResearchAreaLabel ?? "Official research areas")}</h3>${renderList(university.officialResearchAreas ?? [])}</div></div>
      </section>

      <section class="detail-section" aria-labelledby="school-fields-title">
        <div class="detail-section-title"><span>02</span><h2 id="school-fields-title">Connected fields</h2></div>
        <div class="link-row">${matchingTopics.length ? renderSimpleTopicLinks(matchingTopics) : '<p class="callout">No field connections are published until this school profile is researched.</p>'}</div>
      </section>

      <section class="detail-section" aria-labelledby="researchers-title">
        <div class="detail-section-title"><span>03</span><h2 id="researchers-title">Selected professor profiles</h2></div>
        <div class="sample-notice"><strong>Record boundary</strong><p>${escapeHtml(university.sampleNotice)}</p></div>
        <div class="entity-grid">${matchingProfessors.length ? matchingProfessors.map((item) => renderProfessorCard(item, university)).join("") : '<p class="callout">No professor records are published for this school yet.</p>'}</div>
      </section>

      <section class="detail-section" aria-labelledby="labs-title">
        <div class="detail-section-title"><span>04</span><h2 id="labs-title">Labs &amp; highlighted programs</h2></div>
        <div class="detail-columns"><div><h3 class="subsection-title">Sample labs</h3><div class="entity-grid">${matchingLabs.length ? matchingLabs.map((item) => renderLabCard(item, university)).join("") : '<p class="callout">No verified or sample lab is connected yet.</p>'}</div></div><div><h3 class="subsection-title">Highlighted programs</h3>${renderList(university.featuredPrograms ?? [])}</div></div>
      </section>

      <section class="detail-section" aria-labelledby="courses-title">
        <div class="detail-section-title"><span>05</span><h2 id="courses-title">English-language course examples</h2></div>
        <div class="entity-grid">${matchingCourses.length ? matchingCourses.map((item) => renderCourseCard(item, university)).join("") : '<p class="callout">No verified or representative course is connected yet.</p>'}</div>
      </section>

      <section class="detail-section" aria-labelledby="sources-title">
        <div class="detail-section-title"><span>06</span><h2 id="sources-title">Verify with official sources</h2></div>
        <div class="detail-columns">
          <aside class="source-box"><h3>Official university sources</h3><p>Use these pages for current program and research information. University content can change.</p>${renderSources(university.officialSources ?? [])}</aside>
          <aside class="source-box"><h3>Undergraduate research</h3><p>Visit the university's official page to check current ways students can encounter or participate in research.</p>${safeExternalUrl(university.undergraduateResearchUrl) !== "#" ? `<a class="button button-secondary" href="${escapeHtml(safeExternalUrl(university.undergraduateResearchUrl))}">Open official research page <span aria-hidden="true">↗</span></a>` : '<p class="callout">No verified undergraduate research link is available yet.</p>'}</aside>
        </div>
      </section>`;
  } catch (error) {
    console.error(error);
    root.innerHTML = renderErrorState("This university could not load", `${SITE_CONFIG.brand.fullName} could not read its local data. Please refresh and try again.`);
  }
}

const pageInitializers = {
  home: initHome,
  explore: initExplore,
  professors: initProfessorsPage,
  schools: initSchoolsPage,
  fields: initFieldsPage,
  quiz: initQuizPage,
  topic: initTopic,
  professor: initProfessor,
  university: initUniversity,
  about: () => {}
};

const page = document.body.dataset.page;
initSiteChrome(page);
if (pageInitializers[page]) {
  Promise.resolve(pageInitializers[page]()).catch((error) => console.error(error));
}
