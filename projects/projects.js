import { fetchJSON, renderProjects } from '../global.js';
const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');  

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

let searchInput = document.querySelector('.searchBar');

function filterProjects(query) {
  return projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });
}

let selectedIndex = -1;

function getFilteredProjects(query, selectedYear) {
  let filtered = projects;

  if (query) {
    filtered = filtered.filter((project) => {
      let values = Object.values(project).join('\n').toLowerCase();
      return values.includes(query.toLowerCase());
    });
  }

  if (selectedYear) {
    filtered = filtered.filter((p) => p.year === selectedYear);
  }

  return filtered;
}

// Refactor all plotting into one function
function renderPieChart(projectsGiven) {
  let svg = d3.select('svg');
  svg.selectAll('*').remove();

  let legend = d3.select('.legend');
  legend.selectAll('*').remove();

  // re-calculate rolled data
  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );

  // re-calculate data
  let data = rolledData.map(([year, count]) => ({
    label: year,
    value: count
  }));

  if (data.length === 0) return;

  // re-calculate slice generator, arc data, arc, etc.
  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  let sliceGenerator = d3.pie().value((d) => d.value);
  let arcData = sliceGenerator(data);
  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  arcData.forEach((d, idx) => {
    svg.append('path')
      .attr('d', arcGenerator(d))
      .attr('fill', colors(idx))
      .on('click', () => {
        selectedIndex = selectedIndex === idx ? -1 : idx;
        let selectedYear = selectedIndex !== -1 ? data[selectedIndex].label : null;

        svg.selectAll('path').attr('class', (_, i) => i === selectedIndex ? 'selected' : ''); 
        legend.selectAll('li').attr('class', (_, i) => i === selectedIndex ? 'selected' : '');

        let query = searchInput.value;
        let filteredProjects = getFilteredProjects(query, selectedYear);
        renderProjects(filteredProjects, projectsContainer, 'h2');
      });
  });

  data.forEach((d, idx) => {
    legend.append('li')
      .attr('style', `--color:${colors(idx)}`) // set the style attribute while passing in parameters
      .attr('class', 'legend-item')
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`) // set the inner html of <li>
  });
}

// Call this function on page load
renderPieChart(projects);

searchInput.addEventListener('input', (event) => {
  let query = event.target.value;
  // let filteredResults = filterProjects(query);
  let selectedYear = selectedIndex !== -1 ? d3.selectAll('path').data()[selectedIndex]?.label : null;
  let filteredResults = getFilteredProjects(query, selectedYear);
  renderProjects(filteredResults, projectsContainer, 'h2');
  renderPieChart(filteredResults);
});
