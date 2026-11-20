import { writeFile } from 'node:fs/promises';

const query = `query ($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;
const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, variables: { login: process.env.GITHUB_REPOSITORY_OWNER } }),
});
if (!response.ok) throw new Error(`Calendar request failed (${response.status})`);
const { data, errors } = await response.json();
if (errors) throw new Error(errors.map(error => error.message).join(', '));
const calendar = data.user.contributionsCollection.contributionCalendar;
const today = new Date().toISOString().slice(0, 10);
const weeks = calendar.weeks.map(week => week.contributionDays.filter(day => day.date <= today));
let current = 0;
let best = 0;
for (const day of weeks.flat()) {
  if (day.contributionCount > 0) current++;
  else if (day.date < today) current = 0;
  best = Math.max(best, current);
}

const totals = weeks.map(days => days.reduce((sum, day) => sum + day.contributionCount, 0));
const peak = Math.max(1, ...totals);
const pitch = 832 / totals.length;
const bars = totals.map((count, index) => {
  const height = Math.max(2, Math.round(58 * count / peak));
  return `<rect x="${32 + index * pitch}" y="${214 - height}" width="${pitch - 3}" height="${height}" fill="${count ? '#61dce9' : '#35415f'}"><title>${count} contributions</title></rect>`;
});
const metrics = [[calendar.totalContributions, 'Contributions'], [current, 'Current streak · days'], [best, 'Best streak · days']];
const labels = metrics.map(([value, label], i) => `<g transform="translate(${32 + i * 284} 0)">
  <text y="91" font-size="42" font-weight="bold" fill="#fff">${value}</text>
  <text y="118" font-size="18" fill="#ceceed">${label}</text></g>`);
await writeFile('dist/activity.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 896 248" role="img">
  <title>GitHub activity over the past year</title>
  <desc>${calendar.totalContributions} contributions. Current streak ${current} days. Best streak in this period ${best} days.</desc>
  <rect width="896" height="248" rx="12" fill="#0c142b"/>
  <g font-family="monospace">
    <text x="32" y="34" font-size="16" fill="#f69be4">git log / past year</text>
    ${labels.join('')}
    ${bars.join('')}
    <text x="32" y="236" font-size="14" fill="#bac5df">Contributions per week</text>
    <text x="864" y="236" font-size="14" text-anchor="end" fill="#bac5df">through ${today}</text>
  </g>
</svg>\n`);
