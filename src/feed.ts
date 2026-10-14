/** `npm run feed` : régénère le flux RSS depuis episodes.json (aucun appel de voix). */
import { regenerateFeed } from './publish.js';

const { feedUrl, count } = await regenerateFeed();
console.log(`Flux régénéré (${count} épisodes) : ${feedUrl}`);
