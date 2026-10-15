// -----------------------------------------------------------------------------
// Scene action handlers (manifest `scene_actions`, Gladys 5.1+).
//
// Look for new podcast episodes (the server downloads what it finds), and
// read "where am I" as a sentence (for a "say" or a notification: "alice is
// at 33% of Quiet Morning by Jane Doe, 6 min left."). Nothing destructive.
// -----------------------------------------------------------------------------

import { pick } from './texts.js';

export const SCENE_ACTIONS = {
  async check_new_episodes(hub) {
    const { podcasts, episodes } = await hub.checkNewEpisodes();
    return { podcasts, episodes };
  },

  async read_progress(hub, { fields = {} }) {
    const { sentence, title, progress } = await hub.whereAmI(fields.device || null);
    return { sentence: pick(sentence, hub.config.language), title, progress };
  },
};
