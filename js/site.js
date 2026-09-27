const book = window.library[0];
const tree = document.getElementById("book-tree");
const viewer = document.getElementById("simulation-viewer");
const chapterName = document.getElementById("chapter-name");
const topicName = document.getElementById("topic-name");
const contentsToggle = document.getElementById("contents-toggle");
const main = document.querySelector("main");

contentsToggle.addEventListener("click", () => {
  const isCollapsed = main.classList.toggle("contents-collapsed");
  contentsToggle.setAttribute("aria-expanded", String(!isCollapsed));
  contentsToggle.setAttribute("title", isCollapsed ? "Show contents" : "Hide contents");
  contentsToggle.textContent = isCollapsed ? "›" : "‹";
});

function selectTopic(chapter, topic, button) {
  document.querySelectorAll(".topic-button").forEach((item) => item.classList.remove("selected"));
  button.classList.add("selected");
  chapterName.textContent = `Chapter ${chapter.number}: ${chapter.title}`;
  topicName.textContent = topic.title;
  viewer.src = topic.simulation || "simulations/placeholder.html";
}

tree.innerHTML = `<div class="book-name">${book.title}</div>${book.chapters.map((chapter, chapterIndex) => `
  <details class="chapter" ${chapterIndex === 0 ? "open" : ""}>
    <summary><span>Chapter ${chapter.number}</span> ${chapter.title}</summary>
    <div class="topics">${chapter.topics.map((topic, topicIndex) => `<button class="topic-button ${chapterIndex === 0 && topicIndex === 0 ? "selected" : ""}" type="button" data-chapter="${chapter.id}" data-topic="${topic.id}">${topic.title}</button>`).join("")}</div>
  </details>`).join("")}`;

tree.querySelectorAll(".topic-button").forEach((button) => button.addEventListener("click", () => {
  const chapter = book.chapters.find((item) => item.id === button.dataset.chapter);
  const topic = chapter.topics.find((item) => item.id === button.dataset.topic);
  selectTopic(chapter, topic, button);
}));
