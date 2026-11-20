import { readFile, writeFile } from 'node:fs/promises';

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
const bars = '▁▂▃▄▅▆▇█';
const chart = totals.map(count => count ? bars[Math.ceil(count / peak * 7)] : '·').join('');
const daysLabel = days => `${days} ${days === 1 ? 'day' : 'days'}`;
const block = [
  '<!-- activity:start -->',
  '',
  '| Contributions · past year | Current streak | Best streak · past year |',
  '| :---: | :---: | :---: |',
  `| **${calendar.totalContributions}** | **${daysLabel(current)}** | **${daysLabel(best)}** |`,
  '',
  '**Weekly contributions**',
  '',
  '```text',
  chart,
  '```',
  '',
  `Oldest → newest · Peak week: ${Math.max(...totals)} contributions · Updated ${today} UTC`,
  '',
  '[View activity on GitHub](https://github.com/R1shabhCodes?tab=overview)',
  '',
  '<!-- activity:end -->',
].join('\n');
const readme = await readFile('README.md', 'utf8');
const section = /<!-- activity:start -->[\s\S]*?<!-- activity:end -->/g;
if ([...readme.matchAll(section)].length !== 1) throw new Error('Expected one activity section');
await writeFile('README.md', readme.replace(section, () => block));
