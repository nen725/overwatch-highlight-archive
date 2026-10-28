const path = require('node:path');
const crypto = require('node:crypto');
const extensions = new Set(['.mp4', '.webm', '.mkv', '.avi', '.mov']);
function video(file) { return extensions.has(path.extname(file).toLowerCase()); }
function id(file) { return crypto.createHash('sha256').update(path.resolve(file).toLowerCase()).digest('hex').slice(0,24); }
function infer(file, heroes) {
  const name = path.basename(file, path.extname(file));
  const lower = name.toLowerCase();
  const hero = heroes.find(h => [h.name, h.key, h.englishName].some(n => n && lower.includes(n.toLowerCase())));
  const mode = /竞技|competitive/i.test(name) ? '竞技' : /快速|quick.?play/i.test(name) ? '快速' : '待补充';
  return { title: name, hero: hero?.key || '', mode };
}
function validateEdit(data, heroes) {
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200) throw Error('标题需为 1–200 字');
  if (data.hero && !heroes.some(h => h.key === data.hero)) throw Error('英雄不存在，请刷新英雄资料');
  if (!['待补充','快速','竞技','街机先锋','自定义','其他'].includes(data.mode)) throw Error('模式无效');
  if (!Number.isFinite(Date.parse(data.recordedAt))) throw Error('时间无效');
  if (typeof data.notes !== 'string' || data.notes.length > 20000) throw Error('备注过长');
  return {title:data.title.trim(),hero:data.hero,mode:data.mode,recordedAt:new Date(data.recordedAt).toISOString(),notes:data.notes,favorite:!!data.favorite};
}
module.exports = {video,id,infer,validateEdit};
