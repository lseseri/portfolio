let data = [];
let commits = [];
let selectedCommits = [];
let commitProgress = 100;

async function loadData() {
  data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line), // or just +row.line
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  processCommits();
  
  timeScale = d3.scaleTime()
            .domain([d3.min(commits, d => d.datetime), d3.max(commits, d => d.datetime)])
            .range([0, 100]);
  commitMaxTime = timeScale.invert(commitProgress);

  updateStats(commits);
  updateScatterplot(commits);
  updateTooltipVisibility(false);
  brushSelector();
  updateCommitFilter();
}

function processCommits() {
  commits = d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url: 'https://github.com/vis-society/lab-7/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        writable: false,   
        configurable: false 
      });

      return ret;
    });
}

function updateStats(filteredCommits) {
  d3.select('#stats').select('dl').remove();

  // Create the dl element
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  // Add total LOC
  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(filteredCommits.reduce((sum, commit) => sum + commit.totalLines, 0));

  // Add total commits
  dl.append('dt').text('Total Commits');
  dl.append('dd').text(filteredCommits.length);

  // Number of distinct files
  const files = d3.groups(filteredCommits.flatMap((commit) => commit.lines), (d) => d.file).length;
  dl.append('dt').text('Total Files');
  dl.append('dd').text(files);

  // Maximum File Length
  const maxFileLength = d3.max(
    d3.rollups(filteredCommits.flatMap((commit) => commit.lines), (v) => d3.max(v, (d) => d.line), (d) => d.file),
    (d) => d[1]
  );
  dl.append('dt').text('Maximum file length (lines)');
  dl.append('dd').text(maxFileLength);

  // Average File Length
  const fileLengths = d3.rollups(
    filteredCommits.flatMap((commit) => commit.lines),
    (v) => d3.max(v, (v) => v.line),
    (d) => d.file
  );
  const avgFileLength = d3.mean(fileLengths, (d) => d[1]);
  dl.append('dt').text('Average file length (lines)');
  dl.append('dd').text(avgFileLength.toFixed(2));

  // Most active time period
  const workByPeriod = d3.rollups(
    filteredCommits.flatMap((commit) => commit.lines),
    (v) => v.length,
    (d) => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' })
  );
  const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];
  dl.append('dt').text('time of day most work is done');
  dl.append('dd').text(maxPeriod);
}

let xScale, yScale;

function updateScatterplot(filteredCommits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  d3.select('svg').remove();

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(filteredCommits, (d) => d.datetime))
    .range([0, width])
    .nice();

  yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);

  // Update scales with new ranges
  xScale.range([usableArea.left, usableArea.right]);
  yScale.range([usableArea.bottom, usableArea.top]);

  const [minLines, maxLines] = d3.extent(filteredCommits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]); // adjust these values based on your experimentation

  // // Sort commits by total lines in descending order
  // const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  // Add gridlines before axes
  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);

  // Create gridlines as an axis with no labels and full-width ticks
  gridlines
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width))
    .attr('color', 'lightgray');

  // Create the axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  // Add X axis
  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  // Add Y axis
  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  const dots = svg.append('g').attr('class', 'dots');

  dots
    .selectAll('circle')
    .data(filteredCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7) // Add transparency for overlapping dots
    .on('mouseenter', function (event, d, i) {
      d3.select(event.currentTarget).style('fill-opacity', 1); // Full opacity on hover
      updateTooltipContent(d);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', function () {
      d3.select(event.currentTarget).style('fill-opacity', 0.7); // Restore transparency
      updateTooltipContent({});
      updateTooltipVisibility(false);
    });
}

function updateTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  time.textContent = commit.datetime?.toLocaleString('en', {
    timeStyle: 'short',
  });
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

let brushSelection = null;

function brushSelector() {
  const svg = document.querySelector('svg');
  // Create brush
  d3.select(svg).call(d3.brush().on('start brush end', brushed));

  // Raise dots and everything after overlay
  d3.select(svg).selectAll('.dots, .overlay ~ *').raise();
}

function brushed(event) {
  let brushSelection = event.selection;
  selectedCommits = !brushSelection
    ? []
    : commits.filter((filteredCommits) => {
        let min = { x: brushSelection[0][0], y: brushSelection[0][1] };
        let max = { x: brushSelection[1][0], y: brushSelection[1][1] };
        let x = xScale(filteredCommits.date);
        let y = yScale(filteredCommits.hourFrac);

        return x >= min.x && x <= max.x && y >= min.y && y <= max.y;
      });

  updateSelection();
  updateLanguageBreakdown();
}

function isCommitSelected(commit) {
  return selectedCommits.includes(commit);
}

function updateSelection() {
  // Update visual state of dots based on selection
  d3.selectAll('circle').classed('selected', (d) => isCommitSelected(d));
  console.log('Selected circles:', 
    d3.selectAll('circle.selected').size()  // Logs how many circles got the class
  );

  const countElement = document.getElementById('selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

function updateLanguageBreakdown() {
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const requiredCommits = selectedCommits.length ? selectedCommits : commits;
  const lines = requiredCommits.flatMap((d) => d.lines);

  // Use d3.rollup to count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type
  );

  // Update DOM with breakdown
  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
            <dt>${language}</dt>
            <dd>${count} lines (${formatted})</dd>
        `;
  }

  return breakdown;
}

function updateCommitFilter() {
  commitMaxTime = timeScale.invert(commitProgress);

  // Update the <time> element inside the UI
  d3.select("#commit-time-slider").text(commitMaxTime.toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short"
  }));

  // Filter and update commits based on commitMaxTime
  let filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);

  let lines = filteredCommits.flatMap((d) => d.lines);
  let files = [];
  files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    });

    files = d3.sort(files, (d) => -d.lines.length);

  d3.select('.files').selectAll('div').remove(); // don't forget to clear everything first so we can re-render
  let filesContainer = d3.select('.files').selectAll('div').data(files).enter().append('div');
  
  let fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);

  filesContainer.append('dt')
    .append('code')
    .text(d => d.name);

  filesContainer.append('dt')
    .append('small')
    .html(d => `${d.lines.length} lines`);

  filesContainer.append('dd')
    .selectAll('div')
    .data(d => d.lines)
    .enter().append('div')
    .attr('class', 'line')
    .style('background', (d) => fileTypeColors(d.type));
  

  updateStats(filteredCommits);
  // Update the visualization
  updateScatterplot(filteredCommits);
}

d3.select("#commit-slider").on("input", function () {
  commitProgress = +this.value;
  updateCommitFilter();
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
});