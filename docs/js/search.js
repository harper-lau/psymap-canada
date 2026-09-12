const STOP_WORDS = new Set([
  "a", "about", "affect", "and", "are", "behavior", "can", "different", "do", "does", "how",
  "i", "in", "individual", "is", "it", "make", "makes", "manage", "of", "other", "people",
  "person", "social", "some", "than", "that", "the", "their", "they", "to", "we", "what",
  "when", "why", "with"
]);

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/behaviour/g, "behavior")
    .replace(/well-being/g, "wellbeing")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenVariants(token) {
  const variants = new Set([token]);
  if (token.length > 5 && token.endsWith("ies")) variants.add(`${token.slice(0, -3)}y`);
  if (token.length > 4 && token.endsWith("ing")) variants.add(token.slice(0, -3));
  if (token.length > 4 && token.endsWith("ed")) variants.add(token.slice(0, -2));
  if (token.length > 4 && token.endsWith("s")) variants.add(token.slice(0, -1));
  return variants;
}

function makeTokenSet(normalized) {
  const tokens = new Set();
  normalized.split(" ").filter(Boolean).forEach((token) => {
    tokenVariants(token).forEach((variant) => tokens.add(variant));
  });
  return tokens;
}

function containsTerm(normalizedQuestion, tokenSet, rawTerm) {
  const term = normalizeText(rawTerm);
  if (!term) return false;
  if (term.includes(" ")) return ` ${normalizedQuestion} `.includes(` ${term} `);
  return tokenSet.has(term) || [...tokenVariants(term)].some((variant) => tokenSet.has(variant));
}

function meaningfulTerm(rawTerm) {
  const term = normalizeText(rawTerm);
  return term.includes(" ") || (term.length > 2 && !STOP_WORDS.has(term));
}

function canonicalTerm(rawTerm) {
  const term = normalizeText(rawTerm);
  if (term.includes(" ")) return term;
  return [...tokenVariants(term)].sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
}

export function matchQuestion(question, seedQuestions, topics, limit = 4) {
  const normalized = normalizeText(question);
  if (!normalized) return { matches: [], matchedTerms: [], seedMatches: [] };

  const tokenSet = makeTokenSet(normalized);
  const seedMatches = seedQuestions
    .map((seed) => {
      const rawMatches = seed.keywords
        .filter(meaningfulTerm)
        .filter((keyword) => containsTerm(normalized, tokenSet, keyword));
      const matchesByCanonicalTerm = new Map();
      rawMatches.forEach((term) => {
        const canonical = canonicalTerm(term);
        if (!matchesByCanonicalTerm.has(canonical)) matchesByCanonicalTerm.set(canonical, term);
      });
      const matchedTerms = [...matchesByCanonicalTerm.values()];
      return { seed, score: matchesByCanonicalTerm.size, matchedTerms };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.seed.id.localeCompare(b.seed.id));

  const directMatches = topics.map((topic) => {
    const rawTerms = [topic.name, ...topic.aliases]
      .filter(meaningfulTerm)
      .filter((term) => containsTerm(normalized, tokenSet, term));
    const termsByCanonicalForm = new Map();
    rawTerms.forEach((term) => {
      const canonical = canonicalTerm(term);
      if (!termsByCanonicalForm.has(canonical)) termsByCanonicalForm.set(canonical, term);
    });
    return { topic, terms: [...termsByCanonicalForm.values()] };
  }).filter((entry) => entry.terms.length > 0);

  const eligibleSeedMatches = seedMatches;

  if (eligibleSeedMatches.length === 0 && directMatches.length === 0) {
    return { matches: [], matchedTerms: [], seedMatches: [] };
  }

  const topicScores = new Map();
  const topSeedScore = eligibleSeedMatches[0]?.score ?? 0;
  const strongestSeeds = eligibleSeedMatches
    .filter((entry) => entry.score === topSeedScore)
    .slice(0, 3);

  function addTopicScore(topicId, points, terms, sourceQuestion = null) {
    const current = topicScores.get(topicId) ?? { score: 0, terms: new Set(), sourceQuestions: new Set() };
    current.score += points;
    terms.forEach((term) => current.terms.add(term));
    if (sourceQuestion) current.sourceQuestions.add(sourceQuestion);
    topicScores.set(topicId, current);
  }

  strongestSeeds.forEach((entry, index) => {
    const weight = entry.score + Math.max(0, 2 - index);
    entry.seed.topicIds.forEach((topicId, topicIndex) => {
      addTopicScore(topicId, weight - (topicIndex * 0.25), entry.matchedTerms, entry.seed.question);
    });
  });

  directMatches.forEach(({ topic, terms }) => {
    const exactBonus = terms.some((term) => normalizeText(term) === normalized) ? 4 : 0;
    addTopicScore(topic.id, 2 + exactBonus, terms);
  });

  const topicLookup = new Map(topics.map((topic) => [topic.id, topic]));
  const matches = [...topicScores.entries()]
    .map(([topicId, details]) => ({
      topic: topicLookup.get(topicId),
      score: details.score,
      terms: [...details.terms].sort((a, b) => a.localeCompare(b)),
      sourceQuestions: [...details.sourceQuestions]
    }))
    .filter((entry) => entry.topic)
    .sort((a, b) => b.score - a.score || a.topic.name.localeCompare(b.topic.name))
    .slice(0, limit);

  const matchedTerms = [...new Set(matches.flatMap((entry) => entry.terms))].slice(0, 6);
  return { matches, matchedTerms, seedMatches: strongestSeeds };
}

function editDistance(left, right) {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      const substitution = previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1);
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        substitution
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function scoreCandidate(query, candidate) {
  const normalizedQuery = normalizeText(query);
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;
  if (normalizedQuery === normalizedCandidate) return 120;
  if (normalizedCandidate.startsWith(normalizedQuery)) return 96;
  if (normalizedCandidate.includes(normalizedQuery)) return 82;

  const queryTokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
  const candidateTokens = normalizedCandidate.split(" ").filter((token) => token.length > 1);
  const overlap = queryTokens.filter((token) => candidateTokens.some((item) => item.startsWith(token) || token.startsWith(item))).length;
  const tokenScore = overlap ? 54 + (overlap * 8) : 0;

  const compactQuery = normalizedQuery.replaceAll(" ", "");
  const compactCandidate = normalizedCandidate.replaceAll(" ", "");
  const distance = editDistance(compactQuery, compactCandidate);
  const longest = Math.max(compactQuery.length, compactCandidate.length);
  const similarity = longest ? 1 - (distance / longest) : 0;
  let fuzzyScore = similarity >= 0.72 ? Math.round(68 * similarity) : 0;

  // Short university abbreviations are often mistyped more than once on a phone.
  if (
    compactQuery.length >= 2 && compactQuery.length <= 4 &&
    compactCandidate.length === compactQuery.length &&
    compactCandidate[0] === compactQuery[0] && distance <= 2
  ) {
    fuzzyScore = Math.max(fuzzyScore, 58 - (distance * 6));
  }

  return Math.max(tokenScore, fuzzyScore);
}

export function createSearchRecords({ universities = [], professors = [], topics = [] }) {
  return [
    ...universities.map((university) => ({
      id: `school-${university.id}`,
      type: "School",
      label: university.name,
      shortLabel: university.shortName,
      aliases: [university.shortName, ...(university.aliases ?? [])],
      description: [university.location?.city, university.location?.province].filter(Boolean).join(", "),
      href: `university.html?id=${encodeURIComponent(university.id)}`
    })),
    ...professors.map((professor) => ({
      id: `professor-${professor.id}`,
      type: professor.dataStatus === "source-backed" && professor.verification?.status === "verified" && professor.isSample === false
        ? "Professor"
        : professor.isSample === true || professor.dataStatus === "sample"
          ? "Sample professor"
          : "Professor profile",
      label: professor.name,
      shortLabel: professor.name,
      aliases: [professor.title, ...(professor.psymapAreas ?? [])],
      description: professor.summary,
      href: `professor.html?id=${encodeURIComponent(professor.id)}`
    })),
    ...topics.map((topic) => ({
      id: `field-${topic.id}`,
      type: "Field",
      label: topic.name,
      shortLabel: topic.name,
      aliases: [...(topic.aliases ?? []), ...(topic.broadAreas ?? [])],
      description: topic.description,
      href: `topic.html?id=${encodeURIComponent(topic.id)}`
    }))
  ];
}

export function searchCatalog(query, records, limit = 7) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return { results: [], suggestion: null };

  let results = records
    .map((record) => {
      const candidates = [record.label, record.shortLabel, ...(record.aliases ?? [])].filter(Boolean);
      const scoredCandidates = candidates.map((candidate) => ({
        candidate,
        score: scoreCandidate(normalizedQuery, candidate)
      }));
      const best = scoredCandidates.sort((a, b) => b.score - a.score)[0];
      return { ...record, score: best?.score ?? 0, matchedLabel: best?.candidate ?? record.label };
    })
    .filter((record) => record.score >= 40)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit);

  if ((results[0]?.score ?? 0) >= 96) {
    results = results.filter((record) => record.score >= 70);
  }

  const top = results[0];
  const suggestion = top && top.score < 82 && normalizeText(top.shortLabel) !== normalizedQuery
    ? top.shortLabel
    : null;

  return { results, suggestion };
}
