import { escapeHtml, loadData } from "./utils.js?v=20260908-1";

function calculateResults(quiz, topics, formData) {
  const totals = new Map();
  quiz.questions.forEach((question) => {
    const answer = Number(formData.get(question.id));
    Object.entries(question.weights).forEach(([topicId, weight]) => {
      const current = totals.get(topicId) ?? { points: 0, maximum: 0 };
      current.points += (answer - quiz.scale[0].value) * weight;
      current.maximum += (quiz.scale.at(-1).value - quiz.scale[0].value) * weight;
      totals.set(topicId, current);
    });
  });
  const topicLookup = new Map(topics.map((topic) => [topic.id, topic]));
  return [...totals.entries()]
    .map(([topicId, score]) => ({
      topic: topicLookup.get(topicId),
      percent: score.maximum ? Math.round((score.points / score.maximum) * 100) : 0
    }))
    .filter((entry) => entry.topic)
    .sort((a, b) => b.percent - a.percent || a.topic.name.localeCompare(b.topic.name));
}

export async function initQuizPage() {
  const root = document.querySelector("#quiz-root");
  if (!root) return;

  try {
    const { quiz: quizCollection, topics } = await loadData(["quiz", "topics"]);
    const quiz = quizCollection[0];
    if (!quiz) throw new Error("Interest quiz data is empty.");
    const topicLookup = new Map(topics.map((topic) => [topic.id, topic]));

    root.innerHTML = `
      <div class="quiz-layout">
        <aside class="quiz-sidebar">
          <p class="eyebrow"><span></span>Before you begin</p>
          <h2>There is no single “right” field.</h2>
          <p>${escapeHtml(quiz.disclaimer)}</p>
          <div class="quiz-progress" aria-live="polite"><strong id="quiz-progress-count">0 / ${quiz.questions.length}</strong><span>statements answered</span><div><i id="quiz-progress-bar"></i></div></div>
          <a href="#quiz-method">See the scoring method</a>
        </aside>
        <div>
          <form id="interest-quiz-form" class="interest-quiz">
            ${quiz.questions.map((question, questionIndex) => `
              <fieldset class="quiz-question">
                <legend><span>${String(questionIndex + 1).padStart(2, "0")}</span>${escapeHtml(question.prompt)}</legend>
                <div class="quiz-scale" role="radiogroup" aria-label="Preference from strongly dislike to strongly like">
                  ${quiz.scale.map((point, pointIndex) => `
                    <label>
                      <input type="radio" name="${escapeHtml(question.id)}" value="${point.value}"${pointIndex === 0 ? " required" : ""}>
                      <span><strong>${point.value}</strong><small>${escapeHtml(point.label)}</small></span>
                    </label>`).join("")}
                </div>
              </fieldset>`).join("")}
            <div class="quiz-submit-row"><p>Answer all ${quiz.questions.length} statements to see your current interest pattern.</p><button class="button button-primary" type="submit">See my field matches <span aria-hidden="true">→</span></button></div>
          </form>
          <section class="quiz-results" id="quiz-results" hidden aria-labelledby="quiz-results-title"></section>
        </div>
      </div>
      <section class="detail-section quiz-method" id="quiz-method" aria-labelledby="quiz-method-title">
        <div class="detail-section-title"><span>Method</span><h2 id="quiz-method-title">A transparent scoring map</h2></div>
        <p>${escapeHtml(quiz.methodology)}</p>
        <div class="table-scroll"><table><caption>Question-to-field weights used by this prototype</caption><thead><tr><th scope="col">Question</th><th scope="col">Fields receiving weight</th></tr></thead><tbody>
          ${quiz.questions.map((question) => `<tr><th scope="row">${escapeHtml(question.id.toUpperCase())}</th><td>${Object.entries(question.weights).map(([topicId, weight]) => `${escapeHtml(topicLookup.get(topicId)?.name ?? topicId)} ×${weight}`).join(" · ")}</td></tr>`).join("")}
        </tbody></table></div>
      </section>`;

    const form = root.querySelector("#interest-quiz-form");
    const resultsRoot = root.querySelector("#quiz-results");
    const progressCount = root.querySelector("#quiz-progress-count");
    const progressBar = root.querySelector("#quiz-progress-bar");

    function updateProgress() {
      const answered = new Set(new FormData(form).keys()).size;
      progressCount.textContent = `${answered} / ${quiz.questions.length}`;
      progressBar.style.width = `${(answered / quiz.questions.length) * 100}%`;
    }

    form.addEventListener("change", updateProgress);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const results = calculateResults(quiz, topics, new FormData(form));
      const topResults = results.slice(0, 3);
      resultsRoot.innerHTML = `
        <p class="eyebrow"><span></span>Your current pattern</p>
        <h2 id="quiz-results-title">Three fields to explore next</h2>
        <p class="quiz-result-intro">These percentages describe your answers to this activity—not your ability, personality, future success, or eligibility for a program.</p>
        <div class="result-grid">${topResults.map((entry, index) => `
          <article class="result-card">
            <div class="result-rank">0${index + 1}</div>
            <h3>${escapeHtml(entry.topic.name)}</h3>
            <p>${escapeHtml(entry.topic.description)}</p>
            <div class="result-meter" role="progressbar" aria-label="${escapeHtml(entry.topic.name)} interest match" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${entry.percent}"><i style="width:${entry.percent}%"></i></div>
            <strong class="result-percent">${entry.percent}% interest match</strong>
            <div class="result-links"><a href="topic.html?id=${encodeURIComponent(entry.topic.id)}">Explore field</a><a href="professors.html?field=${encodeURIComponent(entry.topic.id)}">Related professors</a></div>
          </article>`).join("")}</div>
        <div class="sample-notice"><strong>Educational, not diagnostic</strong><p>${escapeHtml(quiz.disclaimer)}</p></div>
        <div class="quiz-restart-row"><a class="button button-secondary" href="schools.html">Explore schools</a><button class="button button-primary" type="button" id="restart-quiz">Retake the test</button></div>`;
      resultsRoot.hidden = false;
      form.hidden = true;
      resultsRoot.scrollIntoView({ behavior: "smooth", block: "start" });
      resultsRoot.querySelector("#restart-quiz").addEventListener("click", () => {
        form.reset();
        updateProgress();
        resultsRoot.hidden = true;
        form.hidden = false;
        form.querySelector("input")?.focus();
      });
    });
  } catch (error) {
    console.error(error);
    root.innerHTML = '<div class="directory-empty" role="alert"><h2>The interest explorer could not load.</h2><p>Refresh the page to try loading the local quiz data again.</p></div>';
  }
}
