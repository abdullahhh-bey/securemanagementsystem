import { getResultsReview } from './grading'

export async function getResults(examId) {
  const review = await getResultsReview(examId)
  const scored = review.rows.filter((row) => !row.pending)
  const percentages = scored.map((row) => row.percent)
  const average = percentages.length
    ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length)
    : 0

  return {
    state: review.state,
    publishedAt: review.publishedAt,
    summary: {
      count: scored.length,
      average,
      highest: percentages.length ? Math.max(...percentages) : 0,
      lowest: percentages.length ? Math.min(...percentages) : 0,
      passRate: percentages.length
        ? Math.round((percentages.filter((percent) => percent >= 50).length / percentages.length) * 100)
        : 0,
    },
    rows: review.rows,
  }
}
