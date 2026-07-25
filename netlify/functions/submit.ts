import { containsLikelyPersonName } from '../../src/lib/nameGuard';

// Netlify Function (v2). Receives public submissions and files them into a
// moderation queue as a GitHub issue — it never writes into /data, and
// nothing here is rendered on the public site. A human reviewer promotes an
// accepted submission into a real organisation/source/activity record by
// hand, after checking the source document.

interface SubmissionPayload {
  org_guess?: string;
  source_urls?: string[];
  claim_text?: string;
  notes?: string;
}

const GITHUB_REPO = process.env.SUBMISSIONS_GITHUB_REPO; // e.g. "org/directory-submissions"
const GITHUB_TOKEN = process.env.SUBMISSIONS_GITHUB_TOKEN;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  let payload: SubmissionPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' });
  }

  const org_guess = (payload.org_guess ?? '').trim();
  const claim_text = (payload.claim_text ?? '').trim();
  const notes = (payload.notes ?? '').trim();
  const source_urls = (payload.source_urls ?? []).map((u) => String(u).trim()).filter(Boolean);

  if (!org_guess || !claim_text || source_urls.length === 0) {
    return jsonResponse(400, {
      error: 'Organisation name, source URL and what the document shows are all required.',
    });
  }

  for (const url of source_urls) {
    try {
      new URL(url);
    } catch {
      return jsonResponse(400, { error: `Not a valid URL: ${url}` });
    }
  }

  if (containsLikelyPersonName(org_guess) || containsLikelyPersonName(claim_text) || containsLikelyPersonName(notes)) {
    return jsonResponse(400, {
      error:
        'This looks like it names an individual. This register covers organisations only — please rephrase to describe the organisation and the document, not a person.',
    });
  }

  const submission = {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    submitted_at: new Date().toISOString().slice(0, 10),
    org_guess,
    claim_text,
    source_urls,
    notes: notes || undefined,
    status: 'new' as const,
  };

  if (!GITHUB_REPO || !GITHUB_TOKEN) {
    // Not configured for this deploy target. Fail loudly rather than silently
    // dropping the submission or writing to the public repo.
    console.error('Submission received but SUBMISSIONS_GITHUB_REPO/SUBMISSIONS_GITHUB_TOKEN are not set.', submission);
    return jsonResponse(503, {
      error: 'Submissions are temporarily unavailable. Please try again later.',
    });
  }

  const issueBody = [
    '```yaml',
    `id: ${submission.id}`,
    `submitted_at: ${submission.submitted_at}`,
    `org_guess: ${JSON.stringify(submission.org_guess)}`,
    `claim_text: ${JSON.stringify(submission.claim_text)}`,
    `source_urls:`,
    ...submission.source_urls.map((u) => `  - ${u}`),
    submission.notes ? `notes: ${JSON.stringify(submission.notes)}` : undefined,
    `status: new`,
    '```',
    '',
    '_Filed automatically by the /submit form. Not published. Requires human review against the source before any record is created._',
  ]
    .filter(Boolean)
    .join('\n');

  const ghResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `[submission] ${org_guess}`,
      body: issueBody,
      labels: ['submission', 'status:new'],
    }),
  });

  if (!ghResponse.ok) {
    console.error('Failed to file moderation queue issue', await ghResponse.text());
    return jsonResponse(502, { error: 'Could not file submission. Please try again later.' });
  }

  return jsonResponse(202, { ok: true });
};
