/** Marks one paper is worth: ungrouped questions plus one question per variant group. */
export function computePaperMarks(items) {
  const groups = new Map()
  let total = 0
  for (const item of items) {
    const marks = Number(item.marks) || 0
    if (!item.group) total += marks
    else if (!groups.has(item.group)) groups.set(item.group, marks)
  }
  for (const marks of groups.values()) total += marks
  return total
}
