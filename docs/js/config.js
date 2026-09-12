export const SITE_CONFIG = Object.freeze({
  brand: Object.freeze({
    fullName: "Psychology Map Canada",
    shortName: "SciMap Canada",
    wordmarkPrimary: "Psychology Map",
    wordmarkSuffix: "Canada",
    descriptor: "A field guide to psychology in Canada"
  }),
  navigation: Object.freeze([
    { id: "professors", label: "Professors", href: "professors.html" },
    { id: "schools", label: "Schools", href: "schools.html" },
    { id: "fields", label: "Fields", href: "fields.html" },
    { id: "mobile", label: "Mobile App", href: "mobile-app.html" }
  ])
});

export const PAGE_NAV_GROUPS = Object.freeze({
  professor: "professors",
  professors: "professors",
  university: "schools",
  schools: "schools",
  explore: "fields",
  topic: "fields",
  fields: "fields",
  quiz: "fields",
  mobile: "mobile"
});
