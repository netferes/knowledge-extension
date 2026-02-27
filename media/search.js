const vscode = acquireVsCodeApi();
const queryInput = document.getElementById("query");
const resultsRoot = document.getElementById("results");

let debounceTimer = null;

function groupByRepository(results) {
  const map = new Map();
  for (const item of results) {
    const key = `${item.repositoryName}::${item.repositoryPath}`;
    if (!map.has(key)) {
      map.set(key, {
        repositoryName: item.repositoryName,
        items: []
      });
    }
    map.get(key).items.push(item);
  }
  return [...map.values()];
}

function renderResults(payload) {
  const groups = groupByRepository(payload.results || []);
  resultsRoot.innerHTML = "";

  if (!groups.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = payload.term ? "No results found." : "Type to search.";
    resultsRoot.appendChild(empty);
    return;
  }

  for (const group of groups) {
    const title = document.createElement("div");
    title.className = "repo-group-title";
    title.textContent = group.repositoryName;
    resultsRoot.appendChild(title);

    for (const item of group.items) {
      const el = document.createElement("article");
      el.className = "result-item";

      const pathEl = document.createElement("div");
      pathEl.className = "result-path";
      pathEl.textContent = `${item.filePath}:${item.lineNumber}`;

      const lineEl = document.createElement("div");
      lineEl.className = "result-line";
      lineEl.textContent = item.lineContent || item.matchContext;

      el.append(pathEl, lineEl);
      el.addEventListener("click", () => {
        vscode.postMessage({ type: "openResult", payload: item });
      });
      resultsRoot.appendChild(el);
    }
  }
}

queryInput.addEventListener("input", () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    vscode.postMessage({
      type: "search",
      payload: { term: queryInput.value.trim() }
    });
  }, 300);
});

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "searchResults") {
    renderResults(message.payload);
  }
});

renderResults({ term: "", results: [] });
