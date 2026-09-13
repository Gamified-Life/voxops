const db = require('../db');

function levelForXp(xp) {
  return Math.floor(xp / 100) + 1;
}

// Applies xp/coin deltas to a user, persists them, and reports whether this
// crossed a level-up or a level-10 milestone (used to trigger the reward modal).
async function awardAndFetch(userId, xpDelta, coinDelta = 0) {
  const [[user]] = await db.pool.query('SELECT xp, level, coins FROM users WHERE id=?', [userId]);
  const xp = Math.max(0, user.xp + xpDelta);
  const level = levelForXp(xp);
  const leveledUp = level > user.level;
  const milestone = leveledUp && level % 10 === 0;
  const coins = Math.max(0, user.coins + coinDelta);
  await db.pool.query('UPDATE users SET xp=?, level=?, coins=? WHERE id=?', [xp, level, coins, userId]);
  return { xp, level, coins, leveledUp, milestone };
}

module.exports = { levelForXp, awardAndFetch };
