# n8n — Scheduled LinkedIn posting

Publishes a content post to a sender identity's LinkedIn account at a scheduled time.

## Flow

```
App (PostEditor → "Zakaži objavu")
  → sets content_posts.status = 'scheduled', scheduled_at
  → POST  N8N_LINKEDIN_WEBHOOK_URL   (x-sync-secret header)
        { post_id, sender_profile_id, full_name, linkedin_url,
          content, scheduled_at, callback_url }

n8n:
  Webhook → Wait until scheduled_at
         → GET  callback_url        (verify still 'scheduled' + pull fresh content)
         → IF should_publish
              → LinkedIn: create post (text)
              → POST callback_url    { linkedin_post_url }  → app marks 'published'
```

Cancelling in the app sets the post back to `approved` and clears `scheduled_at`.
The running n8n execution still wakes up, but the verify GET returns
`should_publish: false`, so nothing is posted.

## App env vars

```
N8N_LINKEDIN_WEBHOOK_URL=https://<your-n8n>/webhook/linkedin-schedule
APP_URL=https://<your-app-domain>          # used to build callback_url
SYNC_SECRET=<already set>                   # shared secret, reused for auth
```

For local testing, `APP_URL=http://localhost:3005` and point
`N8N_LINKEDIN_WEBHOOK_URL` at your n8n test webhook. n8n must be able to reach
`APP_URL` (use a tunnel like ngrok/cloudflared if n8n is remote and app is local).

## n8n setup

1. Import `linkedin-schedule-post.workflow.json`.
2. **LinkedIn node** → create/select a **LinkedIn OAuth2** credential for the
   identity, then open the node and pick that person under *Post As → Person*.
   One credential per identity; duplicate the LinkedIn node (or add a Switch on
   `sender_profile_id`) to support multiple identities in one workflow.
3. Replace `REPLACE_WITH_SYNC_SECRET` in both **HTTP Request** nodes with the
   value of `SYNC_SECRET`.
4. Activate the workflow and copy the production webhook URL into
   `N8N_LINKEDIN_WEBHOOK_URL`.

## Notes / limits

- Auto-publish currently supports **text** posts. Image/carousel need a media
  upload step (register upload → upload binary → create post with media) — not
  wired yet; mark those published manually.
- Standard LinkedIn OAuth tokens last ~60 days with no refresh; reconnect the
  credential when it expires (Marketing Developer Platform access enables auto
  refresh).
