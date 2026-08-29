const MAX_RESULTS = 5
const MAX_TITLE_CHARS = 200
const MAX_CONTENT_CHARS = 400

export const slimSearchResults = (raw) => {
  const list = Array.isArray(raw) ? raw : raw?.results
  if (!Array.isArray(list)) return []

  return list.slice(0, MAX_RESULTS).map((r) => {
    const content = String(r.content ?? r.snippet ?? "")
      .replace(/\s+/g, " ")
      .trim()

    return {
      title: String(r.title ?? "").slice(0, MAX_TITLE_CHARS),
      url: String(r.url ?? r.link ?? ""),
      content: content.slice(0, MAX_CONTENT_CHARS)
    }
  })
}