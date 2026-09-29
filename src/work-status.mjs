/** Preserve Canvas evidence; never infer a course grade or erase a scored zero. */
export function workStatus(row, origin, courseId, now = Date.now()) {
  const submission = row.submission;
  const score = typeof submission?.score === 'number' && Number.isFinite(submission.score) ? submission.score : null;
  const possible = typeof row.points_possible === 'number' && Number.isFinite(row.points_possible) ? row.points_possible : null;
  const excused = submission?.excused === true;
  const paperOrExternal = row.submission_types?.some(type => ['on_paper','external_tool','none'].includes(type));
  const pastDue = Boolean(row.due_at && Number.isFinite(Date.parse(row.due_at)) && Date.parse(row.due_at) < now);
  const attention = [];
  if (!excused) {
    if (submission?.missing === true) attention.push('marked_missing_by_canvas');
    if (score === 0 && possible !== null && possible > 0) attention.push('zero_score');
    if (pastDue && submission?.workflow_state === 'unsubmitted' && !submission?.submitted_at)
      attention.push(paperOrExternal ? 'submission_needs_verification' : 'past_due_unsubmitted');
  }
  return {
    id:row.id, name:row.name, due_at:row.due_at ?? null, lock_at:row.lock_at ?? null,
    source:`${origin}/courses/${courseId}/assignments/${row.id}`,
    points_possible:possible, score, grade:submission?.grade ?? null,
    missing:typeof submission?.missing === 'boolean' ? submission.missing : null,
    excused:typeof submission?.excused === 'boolean' ? submission.excused : null,
    workflow_state:submission?.workflow_state ?? null, submitted_at:submission?.submitted_at ?? null,
    submission_types:row.submission_types ?? [],
    omit_from_final_grade:row.omit_from_final_grade ?? null,
    graded_at:submission?.graded_at ?? null, posted_at:submission?.posted_at ?? null,
    attention,
  };
}
