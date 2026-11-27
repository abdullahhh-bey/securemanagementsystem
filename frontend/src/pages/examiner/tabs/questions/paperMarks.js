/** Marks one paper is worth when every assigned question is included. */
export function computePaperMarks(items) {
  return items.reduce((total, item) => total + (Number(item.marks) || 0), 0)
}
