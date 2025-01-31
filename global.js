console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact' },
  { url: 'resume/', title: 'Resume'},
  { url: 'https://github.com/lseseri', title: 'Github'},
];

const ARE_WE_HOME = document.documentElement.classList.contains('home');

let nav = document.createElement('nav');
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  if (!ARE_WE_HOME && !url.startsWith('http')) {
    url = '../' + url;
  }
  // another way to conditionally create links 
  // url = !ARE_WE_HOME && !url.startsWith('http') ? '../' + url : url;

  let a = document.createElement('a');
  a.href = url;
  a.textContent = title;

  if (a.host === location.host && a.pathname === location.pathname) {
    a.classList.add('current');
  } 
  // another way to do this 
  // a.classList.toggle(
  //   'current',
  //   a.host === location.host && a.pathname === location.pathname
  // );

  if (a.host !== location.host) {
    a.target = '_blank';
  }

  nav.append(a);
}

document.body.insertAdjacentHTML(
  'afterbegin',
  `
	<label class="color-scheme">
		Theme:
		<select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
		</select>
	</label>`
);

let select = document.querySelector('.color-scheme select');

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  localStorage.colorScheme = colorScheme;
  select.value = colorScheme;
}

if (localStorage.colorScheme) {
  setColorScheme(localStorage.colorScheme);
} else {
  setColorScheme('light dark');
}
select.addEventListener('input', function (event) {
  const newColorScheme = event.target.value;
  console.log('color scheme changed to', newColorScheme);
  setColorScheme(newColorScheme);
});

let form = document.querySelector('form');

form?.addEventListener('submit', function (event) {
  event.preventDefault();

  let data = new FormData(form);

  let url = form.action;
  url += "?";

  let params = [];

  for (let [name, value] of data) {
    params.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }

  url += params.join("&");
  console.log(url);
  location.href = url;
})

export async function fetchJSON(url) {
  try {
      // Fetch the JSON file from the given URL
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();
      return data; 

  } catch (error) {
      console.error('Error fetching or parsing JSON data:', error);
  }
}

export function renderProjects(project, containerElement, headingLevel = 'h2') {
  // Your code will go here
  containerElement.innerHTML = '';

  const projectCountElement = document.querySelector('.projects-title');
  if (projectCountElement) {
    projectCountElement.textContent = project.length;
  }

  project.forEach(element => {

    const article = document.createElement('article');

    // Create the heading element dynamically
    const heading = document.createElement(headingLevel);
    heading.textContent = element.title;

    article.innerHTML = `
        <h3>${element.title}</h3>
        <img src="${element.image}" alt="${element.title}">
        <p>${element.description}</p>
    `;

    containerElement.appendChild(article);
  });
}

export async function fetchGitHubData(username) {
  // return statement here
  return fetchJSON(`https://api.github.com/users/${username}`);
}